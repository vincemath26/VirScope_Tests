import subprocess
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd
import numpy as np
import io
from flask import send_file
from utils.db import Session
from models.models import GraphText

from utils.viruses.enterovirus import (
    calculate_mean_rpk_difference,
    calculate_moving_sum,
    plot_antigen_map,
    read_ev_polyprotein_uniprot_metadata,
    plot_ev_polyprotein,
)

def compute_rpk(df, abundance_col='abundance', sample_col='sample_id'):
    df = df.copy()
    df['rpk'] = df.groupby(sample_col)[abundance_col].transform(lambda x: x / x.sum() * 1e5)
    return df

def normalize_coordinates(df):
    df['start'], df['end'] = np.minimum(df['start'], df['end']), np.maximum(df['start'], df['end'])
    return df

def plot_species_rpk_heatmap(df, top_n_species=20, output_path=None):
    # Compute rpk
    df = compute_rpk(df)

    # Filter out NA values
    df = df.dropna(subset=['taxon_species', 'sample_id', 'rpk'])

    # Group and pivot
    grouped = df.groupby(['taxon_species', 'sample_id'])['rpk'].mean().reset_index()
    heatmap_data = grouped.pivot(index='taxon_species', columns='sample_id', values='rpk').fillna(0)

    # Top species
    top_species = heatmap_data.sum(axis=1).nlargest(top_n_species).index
    heatmap_data = heatmap_data.loc[top_species]

    # Sort samples
    heatmap_data = heatmap_data[sorted(heatmap_data.columns)]

    # Plot
    plt.figure(figsize=(18, 10))
    sns.heatmap(heatmap_data, cmap="magma", annot=False, cbar_kws={'label': 'Total Peptide RPK'})
    plt.title("Species-Level Peptide Expression Heatmap (RPK)")
    plt.xlabel("Sample ID")
    plt.ylabel("Species")
    plt.tight_layout()

    # Save or return
    if output_path:
        plt.savefig(output_path)
        plt.close()
        return send_file(output_path, mimetype='image/png', as_attachment=False, download_name='species_rpk_heatmap.png')

    buf = io.BytesIO()
    plt.savefig(buf, format="png", dpi=300)
    plt.close()
    buf.seek(0)
    return send_file(buf, mimetype="image/png")

def plot_species_rpk_stacked_barplot(df, top_n_species=10, output_path=None):
    # Compute rpk
    df = compute_rpk(df)

    # Drop missing
    df = df.dropna(subset=['taxon_species', 'rpk'])

    # Top species by mean rpk
    top_species = df.groupby('taxon_species')['rpk'].mean().nlargest(top_n_species).index
    df_filtered = df[df['taxon_species'].isin(top_species)]

    # Pivot
    df_pivoted = df_filtered.pivot_table(index='sample_id', columns='taxon_species', values='rpk', aggfunc='sum').fillna(0)

    # Plot
    df_pivoted.plot(kind='bar', stacked=True, figsize=(14, 8), colormap='viridis')
    plt.title("Stacked Bar Plot of Species Reactivity (RPK) Across Samples", fontsize=16)
    plt.xlabel("Sample ID", fontsize=14)
    plt.ylabel("Total RPK", fontsize=14)
    plt.xticks(rotation=45, ha='right')
    plt.tight_layout()

    # Save or return
    if output_path:
        plt.savefig(output_path)
        plt.close()
        return send_file(output_path, mimetype='image/png', as_attachment=False, download_name='species_rpk_stacked_barplot.png')

    buf = io.BytesIO()
    plt.savefig(buf, format="png", dpi=300)
    plt.close()
    buf.seek(0)
    return send_file(buf, mimetype="image/png")

# Translated Legana's R Code.
def write_antigen_map_fasta(df, output_path):
    if not {'pep_id', 'pep_aa'}.issubset(df.columns):
        raise ValueError("DataFrame missing required columns 'pep_id' or 'pep_aa'")

    df_peptides = df[['pep_id', 'pep_aa']].drop_duplicates()

    with open(output_path, 'w') as f:
        for _, row in df_peptides.iterrows():
            f.write(f">{row['pep_id']}\n{row['pep_aa']}\n")

    return output_path

# I had to learn how to run commands in Python.
# Honestly I was just going to write a script like what I'm currently doing in COMP2041
# But that would have involved creating new file types and I just wanted to keep everything
# nice and concise and one file as a single process.
# https://docs.python.org/3/library/subprocess.html
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

# Translated Legana's R Code.
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

def generate_pdf(upload_id, payload, app=None, return_buffer=False):
    from fpdf import FPDF
    import io
    import os
    import tempfile
    import pandas as pd
    from flask import current_app as flask_app
    from utils.db import Session
    from models.models import Upload, GraphText

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)

    graphs = payload.get("graphs", [])
    if not graphs:
        raise ValueError("No graphs specified for PDF generation")

    UPLOAD_FOLDER = app.config['UPLOAD_FOLDER'] if app else flask_app.config['UPLOAD_FOLDER']
    upload_path = os.path.join(UPLOAD_FOLDER, f"upload_{upload_id}.csv")

    # If file not at upload_{id}.csv, lookup the real filename in DB
    if not os.path.exists(upload_path):
        with Session() as session:
            upload = session.get(Upload, upload_id)
            if not upload:
                raise FileNotFoundError(f"Upload {upload_id} not found")
            upload_path = os.path.join(UPLOAD_FOLDER, upload.name)
            if not os.path.exists(upload_path):
                raise FileNotFoundError(f"Upload file {upload_path} not found")

    # Load CSV once (plotting functions expect df)
    df = pd.read_csv(upload_path, sep=None, engine="python")

    def get_graph_text(graph_type):
        with Session() as session:
            gt = session.query(GraphText).filter_by(upload_id=upload_id, graph_type=graph_type).first()
            return gt.text if gt else ""

    # Helper: call a plotting function that returns a Flask Response (send_file)
    # and extract bytes. Works with the current plot_* implementation which returns send_file(buf,...)
    def resp_to_pngfile(resp_bytes):
        # write bytes to a temp file and return path
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

    # Helper: extract bytes from a Flask response-like object
    def get_bytes_from_response(resp):
        """
        resp may be a Flask Response returned by send_file(buf)
        Use resp.get_data() when possible, otherwise try resp.data or read generator.
        """
        # If it's already bytes
        if isinstance(resp, (bytes, bytearray)):
            return bytes(resp)

        # Flask Response has get_data()
        get_data = getattr(resp, "get_data", None)
        if callable(get_data):
            # disable direct_passthrough to safely read data
            if hasattr(resp, "direct_passthrough"):
                resp.direct_passthrough = False
            return get_data()

        # resp.data attribute sometimes exists
        data_attr = getattr(resp, "data", None)
        if data_attr is not None:
            return data_attr

        # Fallback: try iterating resp.response (generator)
        body = b""
        gen = getattr(resp, "response", None)
        if gen is not None:
            for chunk in gen:
                if isinstance(chunk, str):
                    chunk = chunk.encode()
                body += chunk
            return body

        raise RuntimeError("Could not extract bytes from response object")

    # Iterate requested graphs and embed each as one page
    for g in graphs:
        gtype = g.get("type", "").lower()
        if not gtype:
            continue

        # produce image bytes for this graph using existing functions (without changing them)
        if gtype == "heatmap":
            top_n = int(g.get("topN", 20))
            # call the existing function which returns a Flask response (send_file)
            resp = plot_species_rpk_heatmap(df, top_n_species=top_n, output_path=None)
            img_bytes = get_bytes_from_response(resp)

        elif gtype == "barplot":
            top_n = int(g.get("topN", 10))
            resp = plot_species_rpk_stacked_barplot(df, top_n_species=top_n, output_path=None)
            img_bytes = get_bytes_from_response(resp)

        elif gtype == "antigen_map":
            win_size = int(g.get("win_size", 32))
            step_size = int(g.get("step_size", 4))

            # follow the same sequence used in your antigen_map route
            cache_dir = os.path.join(UPLOAD_FOLDER, 'cache')
            os.makedirs(cache_dir, exist_ok=True)
            fasta_path = os.path.join(cache_dir, f"upload_{upload_id}_peptides.fasta")
            blast_output_path = os.path.join(cache_dir, f"upload_{upload_id}_blast_results.blast")

            write_antigen_map_fasta(df, fasta_path)

            blast_db_prefix = os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                'data', 'raw_data', 'blast_databases', 'coxsackievirusB1_P08291_db'
            )
            if not os.path.exists(blast_db_prefix + ".pin"):
                raise FileNotFoundError("BLAST database not found for antigen_map generation")

            run_blastp(fasta_path, blast_db_prefix, blast_output_path)
            blast_df = read_blast(blast_output_path)
            mean_rpk_df = calculate_mean_rpk_difference(df, blast_df)
            moving_sum_df = calculate_moving_sum(mean_rpk_df, win_size=win_size, step_size=step_size)

            polyprotein_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                                            'data', 'raw_data', 'coxsackievirusB1_P08291.tsv')
            if not os.path.exists(polyprotein_path):
                raise FileNotFoundError("Polyprotein metadata file not found for antigen_map")

            ev_df = read_ev_polyprotein_uniprot_metadata(polyprotein_path)

            resp = plot_antigen_map(moving_sum_df, ev_df=ev_df, output_path=None)
            img_bytes = get_bytes_from_response(resp)

        else:
            # unsupported graph type — skip
            continue

        # Write image bytes to temp png file (FPDF.image is happiest with filenames)
        tmp_png = resp_to_pngfile(img_bytes)
        try:
            # Add a page containing image
            pdf.add_page()
            # Use margin left 10, top 30 for image placement (consistent with other code)
            try:
                pdf.image(tmp_png, x=10, y=30, w=pdf.w - 20)
            except RuntimeError:
                # fallback: smaller width if image too big or image lib issue
                pdf.image(tmp_png, x=10, y=30, w=pdf.w - 40)

            # Insert saved graph text (if any)
            text = get_graph_text(gtype)
            if text:
                # put text below the image (approx)
                # current y after image is uncertain; we place reasonably below
                pdf.set_xy(10, pdf.get_y() + (pdf.h * 0.55))
                pdf.set_font("Arial", size=12)
                pdf.multi_cell(w=pdf.w - 20, h=6, txt=text)
        finally:
            # remove temp png file
            try:
                os.unlink(tmp_png)
            except Exception:
                pass

    # --- Return PDF ---
    if return_buffer:
        pdf_bytes = pdf.output(dest='S').encode('latin1')
        pdf_buf = io.BytesIO(pdf_bytes)
        pdf_buf.seek(0)
        return pdf_buf

    # Otherwise save to disk and return path
    pdf_path = os.path.join(UPLOAD_FOLDER, f"upload_{upload_id}.pdf")
    pdf.output(pdf_path)
    return pdf_path
