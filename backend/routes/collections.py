import os
import pandas as pd
from datetime import datetime
from flask import Blueprint, abort, request, jsonify, current_app, send_file, g
from werkzeug.utils import secure_filename
from utils.db import Session
from models.models import Upload
from routes.auth import jwt_required

collection_bp = Blueprint('collection', __name__)

ALLOWED_EXTENSIONS = {'csv'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# -----------------------
# Helper: get user upload
# -----------------------
def get_user_upload(session, upload_id, user_id):
    upload = session.get(Upload, upload_id)
    if not upload or upload.user_id != user_id:
        return None
    return upload

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

        filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], name_with_ext)
        file.save(filepath)

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
        upload = get_user_upload(session, upload_id, g.current_user_id)
        if not upload:
            return jsonify({"error": "Forbidden"}), 403

        ext = os.path.splitext(upload.name)[1]
        safe_name = secure_filename(new_name + ext)

        old_filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], upload.name)
        new_filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], safe_name)

        if not os.path.exists(old_filepath):
            return jsonify({"error": f"Original file not found: {old_filepath}"}), 404

        try:
            os.rename(old_filepath, new_filepath)
        except Exception as e:
            return jsonify({"error": f"Failed to rename file: {e}"}), 500

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
        upload = get_user_upload(session, upload_id, g.current_user_id)
        if not upload:
            return jsonify({"error": "Forbidden"}), 403

        filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], upload.name)
        if os.path.exists(filepath):
            os.remove(filepath)

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
        upload = get_user_upload(session, upload_id, g.current_user_id)
        if not upload:
            return jsonify({"error": "Forbidden"}), 403

        filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], upload.name)
        if not os.path.exists(filepath):
            return abort(404)

        return send_file(filepath, mimetype='text/csv')

# -----------------------
# Delete all uploads
# -----------------------
@collection_bp.route('/delete-all-uploads', methods=['POST'])
@jwt_required
def delete_all_uploads():
    user_id = g.current_user_id
    upload_dir = current_app.config['UPLOAD_FOLDER']

    with Session() as session:
        uploads = session.query(Upload).filter(Upload.user_id == user_id).all()
        for upload in uploads:
            filepath = os.path.join(upload_dir, upload.name)
            if os.path.exists(filepath):
                try:
                    os.remove(filepath)
                except Exception as e:
                    print(f"Failed to delete file {filepath}: {e}")
            session.delete(upload)
        session.commit()

    return jsonify({'message': 'All your uploads and their files have been deleted.'}), 200
