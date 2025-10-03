import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np
import io
import tempfile
import os
from flask import send_file, current_app
from utils.collections import init_r2_client, download_file_from_r2
from utils.viruses.enterovirus import prepare_antigen_map_df
from utils.db import Session
from utils.r2 import R2_ACCESS_KEY, R2_SECRET_KEY, R2_ENDPOINT_URL, fetch_upload_from_r2
import boto3
from models.models import Upload, GraphText

# -----------------------
# Calculation helpers
# -----------------------
def compute_rpk(df, abundance_col='abundance', sample_col='sample_id'):
    df = df.copy()
    df['rpk'] = df.groupby(sample_col)[abundance_col].transform(lambda x: x / x.sum() * 1e5)
    return df

def normalize_coordinates(df):
    df['start'], df['end'] = np.minimum(df['start'], df['end']), np.maximum(df['start'], df['end'])
    return df

# -----------------------
# Save plot helper
# -----------------------
def save_plot_to_file_or_buf(plt_obj, output_path=None):
    if output_path:
        plt_obj.savefig(output_path, dpi=300, bbox_inches='tight')
        plt_obj.close()
        return send_file(output_path, mimetype='image/png', as_attachment=False)
    buf = io.BytesIO()
    plt_obj.savefig(buf, format='png', dpi=300, bbox_inches='tight')
    plt_obj.close()
    buf.seek(0)
    return send_file(buf, mimetype="image/png")

# -----------------------
# Plot RPK stacked bar
# -----------------------
def plot_rpk_stacked_barplot(df, top_n_species=10, output_path=None):
    top_species = df.groupby('taxon_species')['rpk'].sum().nlargest(top_n_species).index
    plot_df = df[df['taxon_species'].isin(top_species)].copy()
    pivot_df = plot_df.pivot(index='sample_id', columns='taxon_species', values='rpk').fillna(0)
    pivot_df = pivot_df[top_species]

    fig, ax = plt.subplots(figsize=(10, 6))
    pivot_df.plot(kind='bar', stacked=True, ax=ax)
    ax.set_ylabel("RPK")
    ax.set_xlabel("Sample ID")
    ax.set_title("Stacked Bar Plot of RPK per Species")
    plt.xticks(rotation=45, ha='right')
    plt.tight_layout()
    return save_plot_to_file_or_buf(plt, output_path)

# -----------------------
# Plot RPK heatmap
# -----------------------
def plot_rpk_heatmap(df, output_path=None):
    pivot_df = df.pivot(index='taxon_species', columns='sample_id', values='rpk').fillna(0)
    fig, ax = plt.subplots(figsize=(12, 8))
    cax = ax.imshow(pivot_df, aspect='auto', cmap='viridis')
    ax.set_xticks(np.arange(len(pivot_df.columns)))
    ax.set_xticklabels(pivot_df.columns, rotation=45, ha='right')
    ax.set_yticks(np.arange(len(pivot_df.index)))
    ax.set_yticklabels(pivot_df.index)
    fig.colorbar(cax, ax=ax, label='RPK')
    plt.tight_layout()
    return save_plot_to_file_or_buf(plt, output_path)

# -----------------------
# Plot BLAST peptide alignment
# -----------------------
def plot_blast_peptide_alignment(query_fasta, db_path, output_path):
    import subprocess
    tmp_out = tempfile.NamedTemporaryFile(delete=False, suffix=".tsv").name
    cmd = [
        "diamond", "blastp",
        "--query", query_fasta,
        "--db", db_path,
        "--out", tmp_out,
        "--outfmt", "6 qseqid sseqid pident length mismatch gapopen qstart qend sstart send evalue bitscore"
    ]
    subprocess.run(cmd, check=True)
    df = pd.read_csv(tmp_out, sep='\t', header=None)
    os.unlink(tmp_out)

    fig, ax = plt.subplots(figsize=(12, 6))
    for _, row in df.iterrows():
        ax.plot([row[6], row[7]], [row[0], row[0]], color='blue', linewidth=2)
    ax.set_xlabel("Query amino acid position")
    ax.set_ylabel("Peptide")
    ax.set_title("BLAST Peptide Alignments")
    plt.tight_layout()
    return save_plot_to_file_or_buf(plt, output_path)

# -----------------------
# Helper: Initialise R2 client
# -----------------------
def init_r2_client(app=None):
    flask_app = app or current_app
    access_key = flask_app.config.get("R2_ACCESS_KEY_ID") or R2_ACCESS_KEY
    secret_key = flask_app.config.get("R2_SECRET_ACCESS_KEY") or R2_SECRET_KEY
    endpoint = flask_app.config.get("R2_ENDPOINT") or R2_ENDPOINT_URL

    if not access_key or not secret_key or not endpoint:
        raise RuntimeError("R2 credentials or endpoint not configured")

    return boto3.client(
        "s3",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        endpoint_url=endpoint
    )

# -----------------------
# Helper: load uploaded file directly from R2
# -----------------------
def load_upload_file(upload_id, app=None) -> str:
    flask_app = app or current_app
    r2_bucket = flask_app.config.get("R2_BUCKET_NAME")
    if not r2_bucket:
        raise FileNotFoundError("R2_BUCKET not configured for app — cannot fetch uploads")

    with Session() as session:
        upload = session.get(Upload, upload_id)
        if not upload:
            raise FileNotFoundError(f"Upload {upload_id} not found in DB")
    file_name = upload.name

    try:
        r2 = init_r2_client(flask_app)
        resp = r2.get_object(Bucket=r2_bucket, Key=file_name)
        tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".csv")
        tmp_file.write(resp['Body'].read())
        tmp_file.close()
        return tmp_file.name
    except Exception as e:
        raise FileNotFoundError(f"Upload file {file_name} not found in R2: {e}")

# -----------------------
# Generate PDF
# -----------------------
def generate_pdf(upload_id, payload, app=None, return_buffer=False):
    from fpdf import FPDF

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)

    graphs = payload.get("graphs", [])
    if not graphs:
        raise ValueError("No graphs specified for PDF generation")

    upload_path = load_upload_file(upload_id, app)
    df = pd.read_csv(upload_path, sep=None, engine="python")

    def get_graph_text(graph_type):
        with Session() as session:
            gt = session.query(GraphText).filter_by(upload_id=upload_id, graph_type=graph_type).first()
            return gt.text if gt else ""

    def resp_to_pngfile(resp_bytes):
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
        try:
            tmp.write(resp_bytes)
            tmp.flush()
            tmp.close()
            return tmp.name
        except Exception:
            try:
                tmp.close()
            except Exception:
                pass
            os.unlink(tmp.name)
            raise

    def get_bytes_from_response(resp):
        if isinstance(resp, (bytes, bytearray)):
            return bytes(resp)
        get_data = getattr(resp, "get_data", None)
        if callable(get_data):
            if hasattr(resp, "direct_passthrough"):
                resp.direct_passthrough = False
            return get_data()
        data_attr = getattr(resp, "data", None)
        if data_attr is not None:
            return data_attr
        body = b""
        gen = getattr(resp, "response", None)
        if gen is not None:
            for chunk in gen:
                if isinstance(chunk, str):
                    chunk = chunk.encode()
                body += chunk
            return body
        raise RuntimeError("Could not extract bytes from response object")

    for g in graphs:
        gtype = g.get("type", "").lower()
        if not gtype:
            continue

        if gtype == "heatmap":
            top_n = int(g.get("topN", 20))
            df = compute_rpk(df)
            resp = plot_rpk_heatmap(df, output_path=None)
            img_bytes = get_bytes_from_response(resp)

        elif gtype == "barplot":
            top_n = int(g.get("topN", 10))
            df = compute_rpk(df)
            resp = plot_rpk_stacked_barplot(df, top_n_species=top_n, output_path=None)
            img_bytes = get_bytes_from_response(resp)

        elif gtype == "antigen_map":
            win_size = int(g.get("win_size", 32))
            step_size = int(g.get("step_size", 4))

            diamond_db_path = current_app.config.get(
                "COXSACKIE_DB_PATH",
                os.path.join(current_app.root_path, "data", "blast_databases", "coxsackievirusB1_P08291_db.dmnd")
            )

            cache_folder = current_app.config.get(
                "CACHE_FOLDER",
                os.path.join(current_app.root_path, "uploads", "cache")
            )
            os.makedirs(cache_folder, exist_ok=True)
            current_app.logger.info(f"Antigen map cache folder: {cache_folder}")

            moving_sum_df, ev_df, _ = prepare_antigen_map_df(
                upload_id,
                df,
                diamond_db_path=diamond_db_path,
                win_size=win_size,
                step_size=step_size,
                cache_folder=cache_folder
            )

            resp = plot_antigen_map(moving_sum_df, ev_df=ev_df, output_path=None)
            img_bytes = get_bytes_from_response(resp)

        elif gtype == "blast_alignment":
            query_fasta = g.get("query_fasta")
            db_path = g.get("db_path")
            output_path = g.get("output_path")
            resp = plot_blast_peptide_alignment(query_fasta, db_path, output_path)
            img_bytes = get_bytes_from_response(resp)

        else:
            continue

        tmp_png = resp_to_pngfile(img_bytes)
        try:
            pdf.add_page()
            try:
                pdf.image(tmp_png, x=10, y=30, w=pdf.w - 20)
            except RuntimeError:
                pdf.image(tmp_png, x=10, y=30, w=pdf.w - 40)
            text = get_graph_text(gtype)
            if text:
                pdf.set_xy(10, pdf.get_y() + (pdf.h * 0.55))
                pdf.set_font("Arial", size=12)
                pdf.multi_cell(w=pdf.w - 20, h=6, txt=text)
        finally:
            try:
                os.unlink(tmp_png)
            except Exception:
                pass

    if return_buffer:
        pdf_bytes = pdf.output(dest='S').encode('latin1')
        pdf_buf = io.BytesIO(pdf_bytes)
        pdf_buf.seek(0)
        return pdf_buf

    pdf_path = os.path.join(current_app.config['UPLOAD_FOLDER'], f"upload_{upload_id}.pdf")
    pdf.output(pdf_path)
    return pdf_path
