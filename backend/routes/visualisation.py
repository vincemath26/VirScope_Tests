import os
import pandas as pd
from flask import Blueprint, jsonify, current_app, request
from utils.db import Session
from models.models import Upload
from utils.visualisation import (
    calculate_mean_rpk_difference,
    calculate_moving_sum,
    read_blast,
    write_antigen_map_fasta,
    run_blastp,
    read_ev_polyprotein_uniprot_metadata,
    compute_rpk
)

BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
visualisation_bp = Blueprint('visualisation', __name__)

# --- Heatmap JSON ---
@visualisation_bp.route('/species_counts/json/<int:upload_id>', methods=['GET'])
def species_counts_heatmap_json(upload_id):
    try:
        top_n_species = int(request.args.get('top_n_species', 20))
    except ValueError:
        return jsonify({"error": "Invalid top_n_species parameter"}), 400

    with Session() as session:
        upload = session.get(Upload, upload_id)
        if not upload:
            return jsonify({"error": "Upload not found"}), 404
        filename = upload.name

    filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
    if not os.path.exists(filepath):
        return jsonify({"error": "File not found"}), 404

    try:
        df = pd.read_csv(filepath, sep=None, engine="python")
    except Exception as e:
        return jsonify({"error": f"Failed to read data: {str(e)}"}), 400

    required_cols = {'taxon_species', 'sample_id', 'abundance'}
    if not required_cols.issubset(df.columns):
        return jsonify({"error": f"Missing required columns: {required_cols - set(df.columns)}"}), 400

    df = compute_rpk(df)
    df = df.dropna(subset=['taxon_species', 'sample_id', 'rpk'])
    grouped = df.groupby(['taxon_species', 'sample_id'])['rpk'].mean().reset_index()
    heatmap_data = grouped.pivot(index='taxon_species', columns='sample_id', values='rpk').fillna(0)
    top_species = heatmap_data.sum(axis=1).nlargest(top_n_species).index
    heatmap_data = heatmap_data.loc[top_species]
    heatmap_data = heatmap_data[sorted(heatmap_data.columns)]

    return jsonify({
        "species": list(heatmap_data.index),
        "samples": list(heatmap_data.columns),
        "values": heatmap_data.values.tolist()
    })


# --- Stacked barplot JSON ---
@visualisation_bp.route('/species_reactivity_stacked_barplot/json/<int:upload_id>', methods=['GET'])
def species_reactivity_stacked_barplot_json(upload_id):
    try:
        top_n_species = int(request.args.get('top_n_species', 10))
    except ValueError:
        return jsonify({"error": "Invalid top_n_species parameter"}), 400

    with Session() as session:
        upload = session.get(Upload, upload_id)
        if not upload:
            return jsonify({"error": "Upload not found"}), 404
        filename = upload.name

    filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
    if not os.path.exists(filepath):
        return jsonify({"error": "File not found on server"}), 404

    try:
        df = pd.read_csv(filepath, sep=None, engine="python")
    except Exception as e:
        return jsonify({"error": f"Failed to read data: {str(e)}"}), 400

    required_cols = {'taxon_species', 'sample_id', 'abundance'}
    if not required_cols.issubset(df.columns):
        return jsonify({"error": f"Missing required columns: {required_cols - set(df.columns)}"}), 400

    df = compute_rpk(df)
    df = df.dropna(subset=['taxon_species', 'sample_id', 'rpk'])
    grouped = df.groupby(['taxon_species', 'sample_id'])['rpk'].mean().reset_index()
    pivot_df = grouped.pivot(index='sample_id', columns='taxon_species', values='rpk').fillna(0)
    top_species = pivot_df.sum(axis=0).nlargest(top_n_species).index
    pivot_df = pivot_df[top_species]
    pivot_df = pivot_df.sort_index()  # sort samples

    return jsonify({
        "samples": list(pivot_df.index),
        "species": list(pivot_df.columns),
        "values": pivot_df.values.tolist()
    })

# --- Antigen map JSON ---
@visualisation_bp.route('/antigen_map/json/<int:upload_id>', methods=['GET'])
def antigen_map_json(upload_id):
    try:
        win_size = int(request.args.get('win_size', 32))
        step_size = int(request.args.get('step_size', 4))
    except ValueError:
        return jsonify({
            "moving_sum": [],
            "window_start": [],
            "window_end": [],
            "ev_domains": [],
            "error": "Invalid window or step size parameter"
        }), 400

    with Session() as session:
        upload = session.get(Upload, upload_id)
        if not upload:
            return jsonify({
                "moving_sum": [],
                "window_start": [],
                "window_end": [],
                "ev_domains": [],
                "error": "Upload not found"
            }), 404
        filename = upload.name

    filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
    if not os.path.exists(filepath):
        return jsonify({
            "moving_sum": [],
            "window_start": [],
            "window_end": [],
            "ev_domains": [],
            "error": "File not found on server"
        }), 404

    try:
        df = pd.read_csv(filepath, sep=None, engine='python')
    except Exception as e:
        return jsonify({
            "moving_sum": [],
            "window_start": [],
            "window_end": [],
            "ev_domains": [],
            "error": f"Failed to read CSV: {str(e)}"
        }), 400

    try:
        # --- Prepare FASTA ---
        cache_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'cache')
        os.makedirs(cache_dir, exist_ok=True)
        fasta_path = os.path.join(cache_dir, f"upload_{upload_id}_peptides.fasta")
        blast_output_path = os.path.join(cache_dir, f"upload_{upload_id}_blast_results.blast")

        write_antigen_map_fasta(df, fasta_path)

        # --- Run BLAST ---
        blast_db_prefix = os.path.join(
            BACKEND_ROOT, 'data', 'raw_data', 'blast_databases', 'coxsackievirusB1_P08291_db'
        )
        if not os.path.exists(blast_db_prefix + ".pin"):
            return jsonify({
                "moving_sum": [],
                "window_start": [],
                "window_end": [],
                "ev_domains": [],
                "error": "BLAST database not found"
            }), 404

        run_blastp(fasta_path, blast_db_prefix, blast_output_path)
        blast_df = read_blast(blast_output_path)

        # --- Sliding window calculations ---
        mean_rpk_diff_df = calculate_mean_rpk_difference(df, blast_df)
        moving_sum_df = calculate_moving_sum(mean_rpk_diff_df, win_size=win_size, step_size=step_size)

        # --- Condense moving sum per window for frontend ---
        if not moving_sum_df.empty:
            moving_sum_df = moving_sum_df.groupby('window_start', as_index=False)['moving_sum'].sum()
            moving_sum_df['window_end'] = moving_sum_df['window_start'] + win_size - 1

        # --- Load polyprotein metadata ---
        polyprotein_path = os.path.join(BACKEND_ROOT, 'data', 'raw_data', 'coxsackievirusB1_P08291.tsv')
        if not os.path.exists(polyprotein_path):
            return jsonify({
                "moving_sum": [],
                "window_start": [],
                "window_end": [],
                "ev_domains": [],
                "error": "Polyprotein metadata file not found"
            }), 404

        ev_df = read_ev_polyprotein_uniprot_metadata(polyprotein_path)

        # --- Prepare JSON safely ---
        json_data = {
            "moving_sum": moving_sum_df['moving_sum'].tolist() if not moving_sum_df.empty else [],
            "window_start": moving_sum_df['window_start'].tolist() if not moving_sum_df.empty else [],
            "window_end": moving_sum_df['window_end'].tolist() if not moving_sum_df.empty else [],
            "ev_domains": ev_df[['start', 'end', 'ev_proteins']].to_dict(orient='records') if not ev_df.empty else []
        }

        return jsonify(json_data)

    except Exception as e:
        return jsonify({
            "moving_sum": [],
            "window_start": [],
            "window_end": [],
            "ev_domains": [],
            "error": f"Antigen map generation failed: {str(e)}"
        }), 500
