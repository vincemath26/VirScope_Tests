import os
import boto3
from botocore.exceptions import ClientError

# -----------------------
# R2 Helper functions
# -----------------------
def init_r2_client(config=None):
    """
    Initialize R2 client using Flask app config or environment variables.
    """
    if config is None:
        config = {
            'R2_REGION': os.environ.get('R2_REGION'),
            'R2_ENDPOINT': os.environ.get('R2_ENDPOINT'),
            'R2_ACCESS_KEY_ID': os.environ.get('R2_ACCESS_KEY_ID'),
            'R2_SECRET_ACCESS_KEY': os.environ.get('R2_SECRET_ACCESS_KEY')
        }

    missing = [k for k, v in config.items() if not v]
    if missing:
        raise RuntimeError(f"Missing R2 credentials: {', '.join(missing)}")

    return boto3.client(
        's3',
        region_name=config.get('R2_REGION'),
        endpoint_url=config.get('R2_ENDPOINT'),
        aws_access_key_id=config.get('R2_ACCESS_KEY_ID'),
        aws_secret_access_key=config.get('R2_SECRET_ACCESS_KEY')
    )


def upload_file_to_r2(r2_client, bucket, file_obj, object_name):
    try:
        file_obj.seek(0)
        r2_client.upload_fileobj(file_obj, bucket, object_name)
        return True
    except ClientError as e:
        print(f"Failed to upload {object_name} to R2: {e}")
        return False


def download_file_from_r2(r2_client, bucket, object_name, local_path):
    try:
        r2_client.download_file(bucket, object_name, local_path)
        return True
    except ClientError as e:
        print(f"Failed to download {object_name} from R2: {e}")
        return False


def delete_file_from_r2(r2_client, bucket, object_name):
    try:
        r2_client.delete_object(Bucket=bucket, Key=object_name)
        return True
    except ClientError as e:
        print(f"Failed to delete {object_name} from R2: {e}")
        return False


# -----------------------
# Streaming upload helper
# -----------------------
def stream_upload_file_to_r2(r2_client, bucket, file_obj, object_name, chunk_size=5*1024*1024):
    """
    Upload a file-like object to R2 in chunks using multipart upload.
    Default chunk_size: 5 MB
    """
    upload_id = None
    try:
        file_obj.seek(0)  # ensure pointer at start
        mpu = r2_client.create_multipart_upload(Bucket=bucket, Key=object_name)
        upload_id = mpu['UploadId']
        parts = []
        part_number = 1

        while True:
            data = file_obj.read(chunk_size)
            if not data:
                break
            part = r2_client.upload_part(
                Bucket=bucket,
                Key=object_name,
                PartNumber=part_number,
                UploadId=upload_id,
                Body=data
            )
            parts.append({'ETag': part['ETag'], 'PartNumber': part_number})
            part_number += 1

        r2_client.complete_multipart_upload(
            Bucket=bucket,
            Key=object_name,
            UploadId=upload_id,
            MultipartUpload={'Parts': parts}
        )
        return True

    except ClientError as e:
        print(f"Failed to stream upload {object_name} to R2: {e}")
        if upload_id:
            try:
                r2_client.abort_multipart_upload(Bucket=bucket, Key=object_name, UploadId=upload_id)
            except Exception:
                pass
        return False
    except Exception as e:
        print(f"Unexpected error during upload of {object_name}: {e}")
        if upload_id:
            try:
                r2_client.abort_multipart_upload(Bucket=bucket, Key=object_name, UploadId=upload_id)
            except Exception:
                pass
        return False


# -----------------------
# General helpers
# -----------------------
def allowed_file(filename, allowed_extensions={'csv'}):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions


def get_user_upload(session, UploadModel, upload_id, user_id):
    upload = session.get(UploadModel, upload_id)
    if not upload or upload.user_id != user_id:
        return None
    return upload
