import subprocess
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd
import numpy as np
import io
import os
import tempfile
from flask import send_file, current_app
from utils.db import Session
from models.models import GraphText
from utils.collections import init_r2_client, download_file_from_r2

from utils.viruses.enterovirus import (
    calculate_mean_rpk_difference,
    calculate_moving_sum,
    plot_antigen_map,
    read_ev_polyprotein_uniprot_metadata,
    plot_ev_polyprotein,
)

# -----------------------
# RPK helper
# -----------------------
def compute_rpk(df, abundance_col='abundance', sample_col='sample_id'):
    df = df.copy()
    df['rpk'] = df.groupby(sample_col)[abundance_col].transform(lambda x: x / x.sum() * 1e5)
    return df

def normalize_coordinates(df):
    df['start'], df['end'] = np.minimum(df['start'], df['end']), np.maximum(df['start'], df['end'])
    return df

# -----------------------
# Helper: save plot to BytesIO or file
# -----------------------
def save_plot_to_file_or_buf(plt_obj, output_path=None, download_name=None):
    if output_path:
        plt_obj.savefig(output_path, dpi=300, bbox_inches='tight')
        plt_obj.close()
        if download_name:
            return send_file(output_path, mimetype='image/png', as_attachment=False, download_name=download_name)
        return send_file(output_path, mimetype='image/png', as_attachment=False)
    buf = io.BytesIO()
    plt_obj.savefig(buf, format="png", dpi=300, bbox_inches='tight')
    plt_obj.close()
    buf.seek(0)
    return send_file(buf, mimetype="image/png")

# -----------------------
# Species heatmap
# -----------------------
def plot_species_rpk_heatmap(df, top_n_species=20, output_path=None):
    df = compute_rpk(df)
    df = df.dropna(subset=['taxon_species', 'sample_id', 'rpk'])
    grouped = df.groupby(['taxon_species', 'sample_id'])['rpk'].mean().reset_index()
    heatmap_data = grouped.pivot(index='taxon_species', columns='sample_id', values='rpk').fillna(0)
    top_species = heatmap_data.sum(axis=1).nlargest(top_n_species).index
    heatmap_data = heatmap_data.loc[top_species]
    heatmap_data = heatmap_data[sorted(heatmap_data.columns)]

    plt.figure(figsize=(18, 10))
    sns.heatmap(heatmap_data, cmap="magma", annot=False, cbar_kws={'label': 'Total Peptide RPK'})
    plt.title("Species-Level Peptide Expression Heatmap (RPK)")
    plt.xlabel("Sample ID")
    plt.ylabel("Species")
    plt.tight_layout()
    return save_plot_to_file_or_buf(plt, output_path, download_name='species_rpk_heatmap.png')

# -----------------------
# Species stacked barplot
# -----------------------
def plot_species_rpk_stacked_barplot(df, top_n_species=10, output_path=None):
    df = compute_rpk(df)
    df = df.dropna(subset=['taxon_species', 'rpk'])
    top_species = df.groupby('taxon_species')['rpk'].mean().nlargest(top_n_species).index
    df_filtered = df[df['taxon_species'].isin(top_species)]
    df_pivoted = df_filtered.pivot_table(index='sample_id', columns='taxon_species', values='rpk', aggfunc='sum').fillna(0)

    df_pivoted.plot(kind='bar', stacked=True, figsize=(14, 8), colormap='viridis')
    plt.title("Stacked Bar Plot of Species Reactivity (RPK) Across Samples", fontsize=16)
    plt.xlabel("Sample ID", fontsize=14)
    plt.ylabel("Total RPK", fontsize=14)
    plt.xticks(rotation=45, ha='right')
    plt.tight_layout()
    return save_plot_to_file_or_buf(plt, output_path, download_name='species_rpk_stacked_barplot.png')

# -----------------------
# Write antigen map FASTA
# -----------------------
def write_antigen_map_fasta(df, output_path):
    if not {'pep_id', 'pep_aa'}.issubset(df.columns):
        raise ValueError("DataFrame missing required columns 'pep_id' or 'pep_aa'")
    df_peptides = df[['pep_id', 'pep_aa']].drop_duplicates()
    with open(output_path, 'w') as f:
        for _, row in df_peptides.iterrows():
            f.write(f">{row['pep_id']}\n{row['pep_aa']}\n")
    return output_path

# -----------------------
# Run BLAST
# -----------------------
def run_blastp(fasta_path, blast_db_path, blast_output_path):
    cmd = [
        "blastp",
        "-task", "blastp-short",
        "-query", fasta_path,
        "-db", blast_db_path,
        "-outfmt", "6 qaccver saccver pident nident length evalue bitscore mismatch gapopen qstart qend sstart send qseq sseq ppos stitle frames",
        "-evalue", "0.01",
        "-word_size", "2",
        "-out", blast_output_path
    ]
    try:
        subprocess.run(cmd, check=True)
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"BLAST failed: {e}")

# -----------------------
# Read BLAST
# -----------------------
def read_blast(filepath):
    columns = [
        "qaccver", "saccver", "pident", "nident", "length", "evalue", "bitscore",
        "mismatch", "gapopen", "qstart", "qend", "sstart", "send",
        "qseq", "sseq", "ppos", "stitle", "frames"
    ]
    try:
        df = pd.read_csv(filepath, sep="\t", header=None, names=columns)
    except Exception as e:
        raise ValueError(f"Failed to read BLAST file: {e}")
    df = df.drop_duplicates()
    df = df.rename(columns={'sstart': 'start', 'send': 'end', 'qaccver': 'seqid'})
    return normalize_coordinates(df)

# -----------------------
# Load upload from R2 or local
# -----------------------
def load_upload_file(upload_id, app=None):
    flask_app = app or current_app
    upload_folder = flask_app.config['UPLOAD_FOLDER']
    r2_bucket = flask_app.config.get('R2_BUCKET_NAME')

    from models.models import Upload
    with Session() as session:
        upload = session.get(Upload, upload_id)
        if not upload:
            raise FileNotFoundError(f"Upload {upload_id} not found")

    if r2_bucket:
        r2_client = init_r2_client(flask_app.config)
        tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".csv")
        if not download_file_from_r2(r2_client, r2_bucket, upload.name, tmp_file.name):
            raise FileNotFoundError(f"Could not download {upload.name} from R2")
        tmp_file.close()
        return tmp_file.name

    local_path = os.path.join(upload_folder, upload.name)
    if not os.path.exists(local_path):
        raise FileNotFoundError(f"Upload file {local_path} not found")
    return local_path

# -----------------------
# Helper for antigen map caching
# -----------------------
def prepare_antigen_map_df(upload_id, df, win_size=32, step_size=4, app=None):
    BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    UPLOAD_FOLDER = app.config['UPLOAD_FOLDER'] if app else None

    cache_dir = os.path.join(UPLOAD_FOLDER, 'cache')
    os.makedirs(cache_dir, exist_ok=True)
    fasta_path = os.path.join(cache_dir, f"upload_{upload_id}_peptides.fasta")
    blast_output_path = os.path.join(cache_dir, f"upload_{upload_id}_blast_results.blast")

    write_antigen_map_fasta(df, fasta_path)

    blast_db_prefix = os.path.join(BACKEND_ROOT, 'data', 'raw_data', 'blast_databases', 'coxsackievirusB1_P08291_db')
    if not os.path.exists(blast_db_prefix + ".pin"):
        raise FileNotFoundError("BLAST database not found for antigen map generation")

    run_blastp(fasta_path, blast_db_prefix, blast_output_path)
    blast_df = read_blast(blast_output_path)

    mean_rpk_df = calculate_mean_rpk_difference(df, blast_df)
    moving_sum_df = calculate_moving_sum(mean_rpk_df, win_size=win_size, step_size=step_size)

    if not moving_sum_df.empty:
        moving_sum_df = moving_sum_df.groupby('window_start', as_index=False)['moving_sum'].sum()
        moving_sum_df['window_end'] = moving_sum_df['window_start'] + win_size - 1

    polyprotein_path = os.path.join(BACKEND_ROOT, 'data', 'raw_data', 'coxsackievirusB1_P08291.tsv')
    if not os.path.exists(polyprotein_path):
        raise FileNotFoundError("Polyprotein metadata file not found for antigen map")
    ev_df = read_ev_polyprotein_uniprot_metadata(polyprotein_path)

    return moving_sum_df, ev_df

# -----------------------
# Generate PDF with R2 support (in-memory)
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
            resp = plot_species_rpk_heatmap(df, top_n_species=top_n, output_path=None)
            img_bytes = get_bytes_from_response(resp)

        elif gtype == "barplot":
            top_n = int(g.get("topN", 10))
            resp = plot_species_rpk_stacked_barplot(df, top_n_species=top_n, output_path=None)
            img_bytes = get_bytes_from_response(resp)

        elif gtype == "antigen_map":
            win_size = int(g.get("win_size", 32))
            step_size = int(g.get("step_size", 4))
            moving_sum_df, ev_df = prepare_antigen_map_df(upload_id, df, win_size, step_size, app)
            resp = plot_antigen_map(moving_sum_df, ev_df=ev_df, output_path=None)
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
