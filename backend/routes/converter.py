import os
import pandas as pd
from flask import Blueprint, current_app, jsonify, request, g

# ----------------------- Imports -----------------------
from utils.converter import convert_user_upload_to_long
from utils.r2 import R2_BUCKET_NAME, r2_client
from utils.db import Session
from models.models import Upload
from routes.auth import jwt_required

converter_bp = Blueprint('converter', __name__)

# ---------------- Helper to check upload permissions ----------------
def get_upload_or_forbidden(session, upload_id, user_id):
    upload = session.get(Upload, upload_id)
    if not upload:
        return None, jsonify({"error": "Upload not found"}), 404
    if upload.user_id != user_id:
        return None, jsonify({"error": "Forbidden"}), 403
    return upload, None, None

# ---------------- Converters ----------------
@converter_bp.route('/convert_long/<int:upload_id>', methods=['POST'])
@jwt_required
def convert_upload_to_long(upload_id):
    user_id = g.current_user_id
    with Session() as session:
        upload, err_resp, status = get_upload_or_forbidden(session, upload_id, user_id)
        if err_resp:
            return err_resp, status

    try:
        # Use the 'name' column from the Upload model for the R2 filename
        r2_filename = upload.name

        # Convert file to long format and overwrite in R2
        converted_filename = convert_user_upload_to_long(r2_filename, overwrite=True)

        return jsonify({
            "message": "Upload successfully converted to long format",
            "filename": converted_filename
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": f"Conversion failed: {str(e)}"
        }), 500
