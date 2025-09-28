# utils/r2.py
import os
import boto3
from botocore.exceptions import ClientError

# -----------------------
# Load environment variables
# -----------------------
R2_ACCESS_KEY = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME")
R2_ENDPOINT_URL = os.getenv("R2_ENDPOINT")  # e.g., "https://<account_id>.r2.cloudflarestorage.com"

# -----------------------
# Create an R2 client using boto3 (S3 compatible)
# -----------------------
r2_client = boto3.client(
    "s3",
    aws_access_key_id=R2_ACCESS_KEY,
    aws_secret_access_key=R2_SECRET_KEY,
    endpoint_url=R2_ENDPOINT_URL
)

# -----------------------
# Upload a file to R2 bucket
# -----------------------
def upload_file_to_r2(client, bucket_name: str, file_obj, object_name: str) -> bool:
    """
    Uploads a file-like object to R2 bucket.
    """
    try:
        client.upload_fileobj(file_obj, bucket_name, object_name)
        return True
    except ClientError as e:
        print(f"Failed to upload {object_name} to R2: {e}")
        return False

# -----------------------
# Download a file from R2 bucket to local path
# -----------------------
def download_file_from_r2(client, bucket_name: str, object_name: str, local_path: str) -> bool:
    """
    Downloads an object from R2 bucket to a local file.
    """
    try:
        client.download_file(bucket_name, object_name, local_path)
        return True
    except ClientError as e:
        print(f"Failed to download {object_name} from R2: {e}")
        return False

# -----------------------
# Delete a file from R2 bucket
# -----------------------
def delete_file_from_r2(client, bucket_name: str, object_name: str) -> bool:
    """
    Deletes an object from R2 bucket.
    """
    try:
        client.delete_object(Bucket=bucket_name, Key=object_name)
        return True
    except ClientError as e:
        print(f"Failed to delete {object_name} from R2: {e}")
        return False

# -----------------------
# Fetches files from R2 bucket and returns bytes
# -----------------------
def fetch_upload_from_r2(upload_name: str) -> bytes:
    """
    Fetches a file from R2 bucket and returns its content as bytes.
    """
    try:
        response = r2_client.get_object(Bucket=R2_BUCKET_NAME, Key=upload_name)
        return response['Body'].read()
    except ClientError as e:
        raise RuntimeError(f"Failed to fetch {upload_name} from R2: {e}")

# -----------------------
# New streaming upload helper (multipart upload)
# -----------------------
def stream_upload_file_to_r2(client, bucket_name: str, file_obj, object_name: str, chunk_size=5*1024*1024) -> bool:
    """
    Uploads a file-like object to R2 in chunks using multipart upload.
    chunk_size default: 5 MB
    """
    try:
        # 1. Initiate multipart upload
        mpu = client.create_multipart_upload(Bucket=bucket_name, Key=object_name)
        upload_id = mpu['UploadId']
        parts = []
        part_number = 1

        while True:
            data = file_obj.read(chunk_size)
            if not data:
                break
            # 2. Upload each part
            part = client.upload_part(
                Bucket=bucket_name,
                Key=object_name,
                PartNumber=part_number,
                UploadId=upload_id,
                Body=data
            )
            parts.append({'ETag': part['ETag'], 'PartNumber': part_number})
            part_number += 1

        # 3. Complete multipart upload
        client.complete_multipart_upload(
            Bucket=bucket_name,
            Key=object_name,
            UploadId=upload_id,
            MultipartUpload={'Parts': parts}
        )
        return True
    except ClientError as e:
        print(f"Failed to stream upload {object_name} to R2: {e}")
        try:
            # Attempt to abort the multipart upload if something went wrong
            client.abort_multipart_upload(Bucket=bucket_name, Key=object_name, UploadId=upload_id)
        except Exception:
            pass
        return False
