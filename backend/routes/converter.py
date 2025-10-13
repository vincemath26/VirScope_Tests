from flask import Blueprint
from routes.auth import jwt_required

converter_bp = Blueprint('converter', __name__)

# TO BE IMPLEMENTED!!!

# ---------------- Converters ----------------
@converter_bp.route('/convert_long/<int:upload_id>', methods=['POST'])
@jwt_required
def convert_upload_to_long(upload_id):
    pass
