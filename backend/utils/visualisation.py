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
from utils.viruses.enterovirus import prepare_antigen_map_df, plot_antigen_map
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
    return buf.getvalue()

# -----------------------
# Plot RPK stacked bar
# -----------------------
def plot_rpk_stacked_barplot(df, top_n_species=10, output_path=None):
    REQUIRED_COLS = {'sample_id', 'taxon_species'}
    is_raw_df = REQUIRED_COLS.issubset(df.columns)

    if is_raw_df:
        if 'rpk' not in df.columns:
            df = compute_rpk(df)
        df_agg = df.groupby(['sample_id', 'taxon_species'], as_index=False)['rpk'].sum()
        top_species = df_agg.groupby('taxon_species')['rpk'].sum().nlargest(top_n_species).index
        plot_df = df_agg[df_agg['taxon_species'].isin(top_species)]
        pivot_df = plot_df.pivot(index='sample_id', columns='taxon_species', values='rpk').fillna(0)
        pivot_df = pivot_df[top_species]
    else:
        pivot_df = df.copy()

    fig, ax = plt.subplots(figsize=(10, 6))
    pivot_df.plot(kind='bar', stacked=True, ax=ax)
    ax.set_ylabel("RPK")
    ax.set_xlabel("Sample ID")
    ax.set_title("Stacked Bar Plot of RPK per Species")
    plt.xticks(rotation=45, ha='right')
    plt.tight_layout()

    img_bytes = save_plot_to_file_or_buf(plt, output_path)
    # If save_plot_to_file_or_buf returned a Response (when output_path set),
    # propagate it upward (caller may expect a Response).
    if output_path:
        return img_bytes
    # Otherwise it's bytes
    return img_bytes

# -----------------------
# Plot RPK heatmap
# -----------------------
def plot_rpk_heatmap(df, top_n_species=20, output_path=None):
    REQUIRED_COLS = {'sample_id', 'taxon_species'}
    is_raw_df = REQUIRED_COLS.issubset(df.columns)

    if is_raw_df:
        if 'rpk' not in df.columns:
            df = compute_rpk(df)
        df_agg = df.groupby(['sample_id', 'taxon_species'], as_index=False)['rpk'].sum()
        top_species = df_agg.groupby('taxon_species')['rpk'].sum().nlargest(top_n_species).index
        df_agg = df_agg[df_agg['taxon_species'].isin(top_species)]
        pivot_df = df_agg.pivot(index='taxon_species', columns='sample_id', values='rpk').fillna(0)
    else:
        pivot_df = df.copy()

    fig, ax = plt.subplots(figsize=(12, 8))
    cax = ax.imshow(pivot_df.values, aspect='auto', cmap='viridis')
    ax.set_xticks(np.arange(len(pivot_df.columns)))
    ax.set_xticklabels(pivot_df.columns, rotation=45, ha='right')
    ax.set_yticks(np.arange(len(pivot_df.index)))
    ax.set_yticklabels(pivot_df.index)
    fig.colorbar(cax, ax=ax, label='RPK')
    plt.tight_layout()

    img_bytes = save_plot_to_file_or_buf(plt, output_path)
    if output_path:
        return img_bytes
    return img_bytes

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
    pdf.set_auto_page_break(auto=False)

    graphs = payload.get("graphs", [])
    if not graphs:
        raise ValueError("No graphs specified for PDF generation")

    upload_path = load_upload_file(upload_id, app)
    df = pd.read_csv(upload_path, sep=None, engine="python")
    df = compute_rpk(df)

    def get_graph_text(graph_type):
        with Session() as session:
            gt = session.query(GraphText).filter_by(upload_id=upload_id, graph_type=graph_type).first()
            return gt.text if gt else ""

    def get_png_file(img_bytes):
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
        tmp.write(img_bytes)
        tmp.flush()
        tmp.close()
        return tmp.name

    def get_bytes_from_response(resp):
        """Convert a response-like object to bytes."""
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
        raise RuntimeError("Could not extract bytes from response object")

    for g in graphs:
        gtype = g.get("type", "").lower()
        if not gtype:
            continue

        if gtype == "heatmap":
            top_n = int(g.get("topN", 20))
            df_grouped = df.groupby(['taxon_species', 'sample_id'])['rpk'].mean().reset_index()
            pivot = df_grouped.pivot(index='taxon_species', columns='sample_id', values='rpk').fillna(0)
            top_species = pivot.sum(axis=1).nlargest(top_n).index
            pivot = pivot.loc[top_species]
            pivot = pivot[sorted(pivot.columns)]
            resp = plot_rpk_heatmap(pivot, top_n_species=top_n, output_path=None)
            img_bytes = get_bytes_from_response(resp)

        elif gtype == "barplot":
            top_n = int(g.get("topN", 10))
            df_grouped = df.groupby(['taxon_species', 'sample_id'])['rpk'].mean().reset_index()
            pivot = df_grouped.pivot(index='sample_id', columns='taxon_species', values='rpk').fillna(0)
            top_species = pivot.sum(axis=0).nlargest(top_n).index
            pivot = pivot[top_species]
            pivot = pivot.sort_index(axis=1)
            resp = plot_rpk_stacked_barplot(pivot, top_n_species=top_n, output_path=None)
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

        else:
            continue

        tmp_png = get_png_file(img_bytes)
        text = get_graph_text(gtype)

        # ---------------- Page Layout ----------------
        pdf.add_page()
        pdf.set_font("Arial", "B", 16)
        pdf.cell(0, 10, "VirScope", ln=1, align="C")

        pdf.set_xy(10, 20)
        chart_height = pdf.h * 0.55
        text_top = 20 + chart_height + 5

        # Chart top half
        pdf.image(tmp_png, x=10, y=20, w=pdf.w - 20, h=chart_height)

        # Text bottom half
        if text:
            pdf.set_xy(10, text_top)
            pdf.set_font("Arial", size=12)
            pdf.multi_cell(w=pdf.w - 20, h=6, txt=text)

        # Cleanup
        try:
            os.unlink(tmp_png)
        except:
            pass

    if return_buffer:
        pdf_bytes = pdf.output(dest='S').encode('latin1')
        buf = io.BytesIO(pdf_bytes)
        buf.seek(0)
        return buf

    pdf_path = os.path.join(current_app.config['UPLOAD_FOLDER'], f"upload_{upload_id}.pdf")
    pdf.output(pdf_path)
    return pdf_path
