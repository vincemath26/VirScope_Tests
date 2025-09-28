import os
import tempfile
from flask import Blueprint, abort, request, jsonify, send_file, g
from werkzeug.utils import secure_filename
from utils.db import Session
from models.models import Upload
from routes.auth import jwt_required
from utils.collections import allowed_file, get_user_upload
from utils.r2 import r2_client, stream_upload_file_to_r2, download_file_from_r2, delete_file_from_r2

collection_bp = Blueprint('collection', __name__)
ALLOWED_EXTENSIONS = {'csv'}

# -----------------------
# Upload a new file (single-shot)
# -----------------------
@collection_bp.route('/upload', methods=['POST'])
@jwt_required
def upload_file():
    user_id = g.current_user_id

    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    if file and allowed_file(file.filename):
        custom_name = request.form.get('custom_name', file.filename)
        name_with_ext = secure_filename(custom_name)
        if not name_with_ext.lower().endswith('.csv'):
            name_with_ext += '.csv'

        try:
            bucket = os.environ.get('R2_BUCKET_NAME')
            file.seek(0)
            stream_upload_file_to_r2(r2_client, bucket, file, name_with_ext)
        except Exception as e:
            return jsonify({"error": f"Failed to upload file to R2: {e}"}), 500

        with Session() as session:
            upload = Upload(name=name_with_ext, user_id=user_id)
            session.add(upload)
            session.commit()
            upload_id = upload.upload_id

        return jsonify({"message": "File uploaded successfully", "upload_id": upload_id}), 201

    return jsonify({"error": "File type not allowed"}), 400

# -----------------------
# Chunked Upload Endpoint
# -----------------------
@collection_bp.route('/upload-chunk', methods=['POST'])
@jwt_required
def upload_chunk():
    user_id = g.current_user_id
    file = request.files.get('file')
    if not file:
        return jsonify({"error": "No file part in the request"}), 400

    chunk_index = int(request.form.get('chunkIndex', 0))
    total_chunks = int(request.form.get('totalChunks', 1))
    upload_id = request.form.get('upload_id')

    # Fix: get the original name from the first chunk's custom_name, fallback to original filename
    if chunk_index == 0:
        custom_name = request.form.get('custom_name') or file.filename
        name_with_ext = secure_filename(custom_name)
        if not name_with_ext.lower().endswith('.csv'):
            name_with_ext += '.csv'
    else:
        # For subsequent chunks, we must know the final file name from first chunk
        if not upload_id:
            return jsonify({"error": "Missing upload_id for subsequent chunk"}), 400
        # Fetch upload name from DB
        with Session() as session:
            upload = session.get(Upload, int(upload_id))
            if not upload or upload.user_id != user_id:
                return jsonify({"error": "Upload not found or forbidden"}), 403
            name_with_ext = upload.name

    temp_dir = tempfile.gettempdir()
    temp_file_path = os.path.join(temp_dir, f"{name_with_ext}.upload")

    try:
        # Append current chunk to temp file
        with open(temp_file_path, 'ab') as f:
            f.write(file.read())

        # Create DB entry on first chunk
        if chunk_index == 0 and not upload_id:
            with Session() as session:
                upload = Upload(name=name_with_ext, user_id=user_id)
                session.add(upload)
                session.commit()
                upload_id = upload.upload_id

        # Upload to R2 on last chunk
        is_last_chunk = chunk_index + 1 == total_chunks
        if is_last_chunk:
            bucket = os.environ.get('R2_BUCKET_NAME')
            with open(temp_file_path, 'rb') as f:
                stream_upload_file_to_r2(r2_client, bucket, f, name_with_ext)
            os.remove(temp_file_path)

    except Exception as e:
        return jsonify({"error": f"Chunk upload failed: {e}"}), 500

    return jsonify({
        "message": f"Chunk {chunk_index + 1}/{total_chunks} uploaded successfully",
        "upload_id": upload_id,
        "completed": is_last_chunk
    })

# -----------------------
# List all uploads for user
# -----------------------
@collection_bp.route('/uploads', methods=['GET'])
@jwt_required
def list_uploads():
    user_id = g.current_user_id
    with Session() as session:
        uploads = session.query(Upload).filter(Upload.user_id == user_id).all()
        uploads_data = [
            {
                "upload_id": upload.upload_id,
                "name": upload.name,
                "date_created": upload.date_created.isoformat(),
                "date_modified": upload.date_modified.isoformat()
            } for upload in uploads
        ]
    return jsonify(uploads_data)

# -----------------------
# Rename upload
# -----------------------
@collection_bp.route('/upload/<int:upload_id>/rename', methods=['POST'])
@jwt_required
def rename_upload(upload_id):
    new_name = request.json.get("new_name")
    if not new_name:
        return jsonify({"error": "New name is required"}), 400

    with Session() as session:
        upload = get_user_upload(session, Upload, upload_id, g.current_user_id)
        if not upload:
            return jsonify({"error": "Forbidden"}), 403

        ext = os.path.splitext(upload.name)[1]
        safe_name = secure_filename(new_name + ext)

        try:
            bucket = os.environ.get('R2_BUCKET_NAME')
            with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
                temp_path = tmp_file.name

            if not download_file_from_r2(r2_client, bucket, upload.name, temp_path):
                os.remove(temp_path)
                return jsonify({"error": "Failed to download original file from R2"}), 500

            with open(temp_path, 'rb') as f:
                stream_upload_file_to_r2(r2_client, bucket, f, safe_name)

            delete_file_from_r2(r2_client, bucket, upload.name)
            os.remove(temp_path)

        except Exception as e:
            return jsonify({"error": f"Failed to rename file in R2: {e}"}), 500

        upload.name = safe_name
        session.commit()

    return jsonify({"message": "File renamed successfully", "new_name": safe_name})

# -----------------------
# Delete single upload
# -----------------------
@collection_bp.route('/upload/<int:upload_id>', methods=['DELETE'])
@jwt_required
def delete_upload(upload_id):
    with Session() as session:
        upload = get_user_upload(session, Upload, upload_id, g.current_user_id)
        if not upload:
            return jsonify({"error": "Forbidden"}), 403

        try:
            bucket = os.environ.get('R2_BUCKET_NAME')
            delete_file_from_r2(r2_client, bucket, upload.name)
        except Exception as e:
            return jsonify({"error": f"Failed to delete file from R2: {e}"}), 500

        session.delete(upload)
        session.commit()

    return jsonify({"message": "Upload deleted successfully"})

# -----------------------
# Serve CSV file
# -----------------------
@collection_bp.route('/uploads/csv/<int:upload_id>', methods=['GET'])
@jwt_required
def serve_csv(upload_id):
    with Session() as session:
        upload = get_user_upload(session, Upload, upload_id, g.current_user_id)
        if not upload:
            return jsonify({"error": "Forbidden"}), 403

        try:
            bucket = os.environ.get('R2_BUCKET_NAME')
            with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
                temp_path = tmp_file.name

            if not download_file_from_r2(r2_client, bucket, upload.name, temp_path):
                os.remove(temp_path)
                return abort(404)

            response = send_file(temp_path, mimetype='text/csv')
            return response

        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

# -----------------------
# Delete all uploads globally
# -----------------------
@collection_bp.route('/delete-all-uploads', methods=['POST'])
def delete_all_uploads_global():
    with Session() as session:
        uploads = session.query(Upload).all()
        try:
            bucket = os.environ.get('R2_BUCKET_NAME')
            for upload in uploads:
                try:
                    delete_file_from_r2(r2_client, bucket, upload.name)
                except Exception as e:
                    print(f"Failed to delete {upload.name} from R2: {e}")
                session.delete(upload)
            session.commit()
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    return jsonify({'message': 'All uploads and their files have been deleted globally.'}), 200
