import os
import pandas as pd
import tempfile
from datetime import datetime
from flask import Blueprint, abort, request, jsonify, current_app, send_file, g
from werkzeug.utils import secure_filename
from utils.db import Session
from models.models import Upload
from routes.auth import jwt_required
from utils.collections import (
    allowed_file,
    get_user_upload,
    init_r2_client,
    upload_file_to_r2,
    download_file_from_r2,
    delete_file_from_r2
)

collection_bp = Blueprint('collection', __name__)
ALLOWED_EXTENSIONS = {'csv'}


def get_r2_client():
    """Get a new R2 client instance for the current app context"""
    return init_r2_client(current_app.config)


# -----------------------
# Upload a new file
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

        # Upload file to R2
        r2_client = get_r2_client()
        R2_BUCKET = current_app.config.get('R2_BUCKET_NAME')
        success = upload_file_to_r2(r2_client, R2_BUCKET, file, name_with_ext)
        if not success:
            return jsonify({"error": "Failed to upload file to R2"}), 500

        # Add to database
        with Session() as session:
            upload = Upload(name=name_with_ext, user_id=user_id)
            session.add(upload)
            session.commit()
            upload_id = upload.upload_id

        return jsonify({"message": "File uploaded successfully", "upload_id": upload_id}), 201

    return jsonify({"error": "File type not allowed"}), 400


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

        r2_client = get_r2_client()
        R2_BUCKET = current_app.config.get('R2_BUCKET_NAME')

        # Rename in R2 by downloading to temp file, re-uploading, then deleting original
        try:
            with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
                temp_path = tmp_file.name
            if not download_file_from_r2(r2_client, R2_BUCKET, upload.name, temp_path):
                os.remove(temp_path)
                return jsonify({"error": "Failed to download original file from R2"}), 500

            with open(temp_path, 'rb') as f:
                if not upload_file_to_r2(r2_client, R2_BUCKET, f, safe_name):
                    os.remove(temp_path)
                    return jsonify({"error": "Failed to upload renamed file to R2"}), 500

            delete_file_from_r2(r2_client, R2_BUCKET, upload.name)
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

        r2_client = get_r2_client()
        R2_BUCKET = current_app.config.get('R2_BUCKET_NAME')

        delete_file_from_r2(r2_client, R2_BUCKET, upload.name)
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

        r2_client = get_r2_client()
        R2_BUCKET = current_app.config.get('R2_BUCKET_NAME')

        # Use tempfile for cross-platform temporary file storage
        with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
            temp_path = tmp_file.name

        if not download_file_from_r2(r2_client, R2_BUCKET, upload.name, temp_path):
            os.remove(temp_path)
            return abort(404)

        response = send_file(temp_path, mimetype='text/csv')
        return response


# -----------------------
# Delete all uploads globally
# -----------------------
@collection_bp.route('/delete-all-uploads', methods=['POST'])
def delete_all_uploads_global():
    with Session() as session:
        uploads = session.query(Upload).all()  # Grab all uploads, not just one user
        r2_client = get_r2_client()
        R2_BUCKET = current_app.config.get('R2_BUCKET_NAME')

        for upload in uploads:
            delete_file_from_r2(r2_client, R2_BUCKET, upload.name)
            session.delete(upload)
        session.commit()

    return jsonify({'message': 'All uploads and their files have been deleted globally.'}), 200
