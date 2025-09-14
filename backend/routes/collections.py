import os
import pandas as pd
from datetime import datetime
from flask import Blueprint, abort, request, jsonify, current_app, send_file, jsonify
from werkzeug.utils import secure_filename
from utils.db import engine, Session  # import Session & engine from db.py
from models.models import Upload  # make sure Upload is imported from models.models

collection_bp = Blueprint('collection', __name__)

ALLOWED_EXTENSIONS = {'csv'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@collection_bp.route('/upload', methods=['POST'])
def upload_file():
    # Get user_id from form data (multipart/form-data)
    user_id = request.form.get('user_id')
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)

        # Save the file to disk
        file.save(filepath)

        # Save upload info to database
        with Session() as session:
            upload = Upload(name=filename, user_id=int(user_id))
            session.add(upload)
            session.commit()
            upload_id = upload.upload_id  # Capture before session closes

        return jsonify({"message": "File uploaded successfully", "upload_id": upload_id}), 201

    return jsonify({"error": "File type not allowed"}), 400

@collection_bp.route('/uploads/<int:user_id>', methods=['GET'])
def list_uploads(user_id):
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

@collection_bp.route('/upload/<int:upload_id>', methods=['DELETE'])
def delete_upload(upload_id):
    with Session() as session:
        upload = session.get(Upload, upload_id)
        if not upload:
            return jsonify({"error": "Upload not found"}), 404

        filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], upload.name)
        if os.path.exists(filepath):
            os.remove(filepath)

        session.delete(upload)
        session.commit()

    return jsonify({"message": "Upload deleted successfully"})

@collection_bp.route('/uploads/csv/<int:upload_id>', methods=['GET'])
def serve_csv(upload_id):
    with Session() as session:
        upload = session.get(Upload, upload_id)
        if not upload:
            return abort(404)
        filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], upload.name)
        if not os.path.exists(filepath):
            return abort(404)
        return send_file(filepath, mimetype='text/csv')

# Admin related code - deleting all uploads
@collection_bp.route('/delete-all-uploads', methods=['POST'])
def delete_all_uploads():
    upload_dir = current_app.config['UPLOAD_FOLDER']

    with Session() as session:
        # Step 1: Get all uploads
        uploads = session.query(Upload).all()

        # Step 2: Delete each file from disk
        for upload in uploads:
            filepath = os.path.join(upload_dir, upload.name)
            if os.path.exists(filepath):
                try:
                    os.remove(filepath)
                except Exception as e:
                    print(f"Failed to delete file {filepath}: {e}")

        # Step 3: Delete all Upload records from DB
        session.query(Upload).delete()
        session.commit()

    return jsonify({'message': 'All uploads and their files have been deleted.'}), 200

@collection_bp.route('/search/<int:user_id>', methods=['GET'])
def search_uploads(user_id):
    query = request.args.get('q', '').strip()
    if not query:
        return jsonify({"error": "Search query is required"}), 400

    with Session() as session:
        uploads = (
            session.query(Upload)
            .filter(
                Upload.user_id == user_id,
                Upload.name.ilike(f"%{query}%")  # case-insensitive match
            )
            .all()
        )

        results = [
            {
                "upload_id": upload.upload_id,
                "name": upload.name,
                "date_created": upload.date_created.isoformat(),
                "date_modified": upload.date_modified.isoformat()
            }
            for upload in uploads
        ]

    return jsonify(results)
