import os
import tempfile
import csv
from flask import Blueprint, abort, request, jsonify, send_file, g, after_this_request
from werkzeug.utils import secure_filename
from utils.db import Session
from models.models import Upload, Workspace
from datetime import datetime
from routes.auth import jwt_required
from utils.collections import allowed_file, get_user_upload
from utils.r2 import r2_client, upload_file_to_r2, download_file_from_r2, delete_file_from_r2

collection_bp = Blueprint('collection', __name__)
ALLOWED_EXTENSIONS = {'csv'}

# -----------------------
# Upload a new file
# -----------------------
@collection_bp.route('/upload', methods=['POST'])
@jwt_required
def upload_file():
    user_id = g.current_user_id
    workspace_id = request.form.get('workspace_id', type=int)

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
            upload_file_to_r2(r2_client, bucket, file, name_with_ext)
        except Exception as e:
            return jsonify({"error": f"Failed to upload file to R2: {e}"}), 500

        with Session() as session:
            upload = Upload(name=name_with_ext, user_id=user_id, workspace_id=workspace_id)
            session.add(upload)
            session.commit()
            upload_id = upload.upload_id

        return jsonify({"message": "File uploaded successfully", "upload_id": upload_id}), 201

    return jsonify({"error": "File type not allowed"}), 400

# -----------------------
# Replace an upload
# -----------------------
@collection_bp.route('/upload/<int:upload_id>/replace', methods=['POST'])
@jwt_required
def replace_upload(upload_id):
    user_id = g.current_user_id

    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    with Session() as session:
        upload = get_user_upload(session, Upload, upload_id, user_id)
        if not upload:
            return jsonify({"error": "Forbidden"}), 403

        name_with_ext = secure_filename(file.filename)
        if not name_with_ext.lower().endswith('.csv'):
            name_with_ext += '.csv'

        try:
            bucket = os.environ.get('R2_BUCKET_NAME')
            # Upload new file
            file.seek(0)
            upload_file_to_r2(r2_client, bucket, file, name_with_ext)
            # Delete old file
            delete_file_from_r2(r2_client, bucket, upload.name)
        except Exception as e:
            return jsonify({"error": f"Failed to replace file in R2: {e}"}), 500

        upload.name = name_with_ext
        upload.date_modified = datetime.utcnow()
        session.commit()

    return jsonify({"message": "Upload replaced successfully", "new_name": name_with_ext})

# -----------------------
# Get single upload
# -----------------------
@collection_bp.route('/upload/<int:upload_id>', methods=['GET'])
@jwt_required
def get_upload(upload_id):
    with Session() as session:
        upload = session.query(Upload).filter(
            Upload.upload_id == upload_id,
            Upload.user_id == g.current_user_id
        ).first()
        
        if not upload:
            return jsonify({"error": "Upload not found"}), 404

        return jsonify({
            "upload_id": upload.upload_id,
            "name": upload.name,
            "workspace_id": upload.workspace_id,
            "date_created": upload.date_created.isoformat(),
            "date_modified": upload.date_modified.isoformat()
        })

# -----------------------
# List all uploads for user (optional workspace filter)
# -----------------------
@collection_bp.route('/uploads', methods=['GET'])
@jwt_required
def list_uploads():
    user_id = g.current_user_id
    workspace_id = request.args.get('workspace_id', type=int)
    with Session() as session:
        query = session.query(Upload).filter(Upload.user_id == user_id)
        if workspace_id:
            query = query.filter(Upload.workspace_id == workspace_id)
        uploads = query.all()
        uploads_data = [
            {
                "upload_id": upload.upload_id,
                "name": upload.name,
                "workspace_id": upload.workspace_id,
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
                upload_file_to_r2(r2_client, bucket, f, safe_name)

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
# Preview CSV file
# -----------------------
@collection_bp.route('/uploads/csv-preview/<int:upload_id>', methods=['GET'])
@jwt_required
def preview_csv(upload_id):
    start = int(request.args.get('start', 0))       # default 0
    limit = int(request.args.get('limit', 50))      # default 50 rows

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
            return jsonify({"error": "Failed to access file"}), 500

        # Read only the required slice
        rows = []
        with open(temp_path, newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(reader):
                if i < start:
                    continue
                if i >= start + limit:
                    break
                rows.append(row)
            fieldnames = reader.fieldnames

        os.remove(temp_path)
        return jsonify({
            "fieldnames": fieldnames,
            "rows": rows,
            "start": start,
            "limit": limit,
            "row_count": i + 1  # total rows read so far
        })

    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({"error": f"Failed to preview CSV: {e}"}), 500

# -----------------------
# Workspace routes
# -----------------------
@collection_bp.route('/workspace', methods=['POST'])
@jwt_required
def create_workspace():
    user_id = g.current_user_id
    data = request.json or {}

    title = data.get('title', '').strip()
    description = data.get('description', '').strip()

    if not title:
        return jsonify({"error": "Workspace title is required"}), 400

    with Session() as session:
        workspace = Workspace(
            user_id=user_id,
            title=title,
            description=description,
            date_created=datetime.utcnow(),
            date_modified=datetime.utcnow()
        )
        session.add(workspace)
        session.commit()
        workspace_id = workspace.workspace_id

    return jsonify({
        "message": "Workspace created successfully",
        "workspace": {
            "workspace_id": workspace_id,
            "title": title,
            "description": description,
            "date_created": workspace.date_created.isoformat(),
            "date_modified": workspace.date_modified.isoformat()
        }
    }), 201

@collection_bp.route('/workspace/<int:workspace_id>', methods=['GET'])
@jwt_required
def get_workspace(workspace_id):
    with Session() as session:
        workspace = session.query(Workspace).filter(
            Workspace.workspace_id == workspace_id,
            Workspace.user_id == g.current_user_id
        ).first()
        if not workspace:
            return jsonify({"error": "Workspace not found"}), 404

        return jsonify({
            "workspace_id": workspace.workspace_id,
            "title": workspace.title,
            "description": workspace.description,
            "date_created": workspace.date_created.isoformat(),
            "date_modified": workspace.date_modified.isoformat()
        })

@collection_bp.route('/workspaces', methods=['GET'])
@jwt_required
def list_workspaces():
    user_id = g.current_user_id
    with Session() as session:
        workspaces = session.query(Workspace).filter(Workspace.user_id == user_id).all()
        workspaces_data = [
            {
                "workspace_id": ws.workspace_id,
                "title": ws.title,
                "description": ws.description,
                "date_created": ws.date_created.isoformat(),
                "date_modified": ws.date_modified.isoformat()
            } for ws in workspaces
        ]
    return jsonify(workspaces_data)

@collection_bp.route('/workspace/<int:workspace_id>/rename', methods=['POST'])
@jwt_required
def rename_workspace(workspace_id):
    new_title = request.json.get("new_title", "").strip()
    new_description = request.json.get("new_description", "").strip()

    if not new_title:
        return jsonify({"error": "New title is required"}), 400

    with Session() as session:
        workspace = session.query(Workspace).filter(
            Workspace.workspace_id == workspace_id,
            Workspace.user_id == g.current_user_id
        ).first()

        if not workspace:
            return jsonify({"error": "Workspace not found or forbidden"}), 403

        workspace.title = new_title
        workspace.description = new_description
        workspace.date_modified = datetime.utcnow()
        session.commit()

        workspace_data = {
            "workspace_id": workspace.workspace_id,
            "title": workspace.title,
            "description": workspace.description,
            "date_created": workspace.date_created.isoformat(),
            "date_modified": workspace.date_modified.isoformat()
        }

    return jsonify({
        "message": "Workspace updated successfully",
        "workspace": workspace_data
    })

@collection_bp.route('/workspace/<int:workspace_id>', methods=['DELETE'])
@jwt_required
def delete_workspace(workspace_id):
    with Session() as session:
        workspace = session.query(Workspace).filter(
            Workspace.workspace_id == workspace_id,
            Workspace.user_id == g.current_user_id
        ).first()

        if not workspace:
            return jsonify({"error": "Workspace not found or forbidden"}), 403

        session.delete(workspace)
        session.commit()

    return jsonify({"message": "Workspace deleted successfully"})

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

# -----------------------
# Delete all workspaces globally
# -----------------------
@collection_bp.route('/delete-all-workspaces', methods=['POST'])
def delete_all_workspaces_global():
    with Session() as session:
        try:
            workspaces = session.query(Workspace).all()
            for ws in workspaces:
                session.delete(ws)
            session.commit()
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    return jsonify({'message': 'All workspaces have been deleted globally.'}), 200
