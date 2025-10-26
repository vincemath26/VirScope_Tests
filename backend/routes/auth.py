from flask import Blueprint, request, jsonify, session, g, current_app
from sqlalchemy.orm import Session as SqlAlchemySession
from models.models import User
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
import jwt
import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Define Blueprint
auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/check-site-password', methods=['POST'])
def check_site_password():
    data = request.get_json() or {}
    password = data.get('password')

    if not password:
        return jsonify({'error': 'Missing password'}), 400

    site_password = current_app.config.get('SITE_PASSWORD')

    if password == site_password:
        exp_time = datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        payload = {
            'site_access': True,
            'iat': datetime.datetime.utcnow(),
            'exp': exp_time
        }
        token = jwt.encode(payload, current_app.secret_key, algorithm='HS256')
        return jsonify({'message': 'Access granted', 'token': token}), 200

    return jsonify({'error': 'Invalid site password'}), 401

@auth_bp.route('/verify-site-token', methods=['POST'])
def verify_site_token():
    token = request.json.get('token')

    if not token:
        return jsonify({'error': 'Token missing'}), 400

    try:
        decoded = jwt.decode(token, current_app.secret_key, algorithms=['HS256'])
        if decoded.get('site_access'):
            return jsonify({'valid': True}), 200
        return jsonify({'valid': False}), 401
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401

@auth_bp.route('/users', methods=['GET'])
def list_users():
    from app import engine  # lazy import inside function
    with SqlAlchemySession(engine) as db_session:
        users = db_session.query(User).all()
        users_data = [
            {
                'user_id': user.user_id,
                'username': user.username,
                'email': user.email,
                # password is not included for security reasons
            }
            for user in users
        ]
    return jsonify(users_data)

@auth_bp.route('/register', methods=['POST'])
def register():
    from app import engine  # lazy import engine
    data = request.get_json() or {}

    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    if not username or not email or not password:
        return jsonify({'error': 'Missing username, email, or password'}), 400

    hashed_password = generate_password_hash(password)

    with SqlAlchemySession(engine) as db_session:
        existing_user = db_session.query(User).filter(
            (User.username == username) | (User.email == email)
        ).first()
        if existing_user:
            return jsonify({'error': 'User with that username or email already exists'}), 400

        new_user = User(username=username, email=email, password=hashed_password)
        db_session.add(new_user)
        db_session.commit()

        # Generate JWT token for new user
        token = jwt.encode({'user_id': new_user.user_id}, current_app.secret_key, algorithm='HS256')

        logger.info(f"New user called '{username}' registered!")

    return jsonify({
        'message': 'User registered successfully',
        'token': token,
        'user_id': new_user.user_id
    }), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    from app import engine  # lazy import engine
    data = request.get_json() or {}

    username_or_email = data.get('username')
    password = data.get('password')

    if not username_or_email or not password:
        return jsonify({'error': 'Missing username/email or password'}), 400

    logger.info(f"Login attempt by '{username_or_email}'")

    with SqlAlchemySession(engine) as db_session:
        user = db_session.query(User).filter(
            (User.username == username_or_email) | (User.email == username_or_email)
        ).first()

        if user and check_password_hash(user.password, password):
            # Generate JWT token and send it back in the response
            token = jwt.encode(
                {'user_id': user.user_id}, current_app.secret_key, algorithm='HS256'
            )
            logger.info(f"User '{user.username}' logged in!")
            return jsonify({'message': 'Login successful', 'token': token, 'user_id': user.user_id}), 200

    logger.warning(f"Failed login attempt for '{username_or_email}'")
    return jsonify({'error': 'Invalid credentials'}), 401

@auth_bp.route('/logout', methods=['POST'])
def logout():
    from app import engine  # lazy import engine
    # Get the token from the Authorization header
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'error': 'Token is missing'}), 400

    # Strip the 'Bearer ' prefix if it exists
    token = token.replace('Bearer ', '', 1)

    try:
        # If using JWT, decode it to validate and get user info
        decoded_token = jwt.decode(token, current_app.secret_key, algorithms=['HS256'])
        user_id = decoded_token.get('user_id')

        if not user_id:
            return jsonify({'error': 'Invalid token: User ID not found'}), 401

        with SqlAlchemySession(engine) as db_session:
            user = db_session.query(User).filter_by(user_id=user_id).first()
            username = user.username if user else f"ID {user_id}"

        # Optionally clear the session
        session.pop('user_id', None)

        logger.info(f"User '{username}' logged out!")

        return jsonify({'message': 'Logout successful'}), 200
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401
    except Exception as e:
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500

# Admin related code - deleting all users
@auth_bp.route('/delete-all-users', methods=['POST'])
def delete_all_users():
    from app import engine  # lazy import engine
    with SqlAlchemySession(engine) as db_session:
        deleted = db_session.query(User).delete()
        db_session.commit()
    return jsonify({'message': f'{deleted} user(s) deleted.'}), 200

def jwt_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': 'Authorization token missing'}), 401

        # Strip 'Bearer ' if present
        token = token.replace('Bearer ', '', 1)

        try:
            decoded = jwt.decode(token, current_app.secret_key, algorithms=['HS256'])
            user_id = decoded.get('user_id')
            if not user_id:
                return jsonify({'error': 'Invalid token: user_id missing'}), 401

            # Attach user_id to flask.g for use in route
            g.current_user_id = user_id

        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401

        return f(*args, **kwargs)

    return decorated_function
