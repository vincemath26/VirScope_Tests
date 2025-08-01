import os
import tempfile
import pandas as pd
from flask import Blueprint, jsonify, send_file, current_app, request
from utils.db import Session
from models.models import Upload
from utils.visualisation import (
  calculate_mean_rpk_difference,
  calculate_moving_sum,
  plot_species_rpk_heatmap, 
  plot_species_rpk_stacked_barplot, 
  plot_filtered_species_rpk_heatmap,
  plot_antigen_map, 
  read_blast,
  write_antigen_map_fasta,
  run_blastp,
  read_ev_polyprotein_uniprot_metadata
)

BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

visualisation_bp = Blueprint('visualisation', __name__)

@visualisation_bp.route('/species_counts/<int:upload_id>', methods=['GET'])
def species_counts_heatmap(upload_id):
    try:
        top_n_species = int(request.args.get('top_n_species', 20))
    except ValueError:
        return jsonify({"error": "Invalid top_n_species parameter"}), 400

    # Fetch upload
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

    # Check required columns
    required_cols = {'taxon_species', 'sample_id', 'abundance'}
    if not required_cols.issubset(df.columns):
        return jsonify({"error": f"Missing required columns: {required_cols - set(df.columns)}"}), 400

    # Generate plot
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmpfile:
        try:
            return plot_species_rpk_heatmap(df, top_n_species=top_n_species, output_path=tmpfile.name)
        except Exception as e:
            return jsonify({"error": str(e)}), 500

@visualisation_bp.route('/species_reactivity_stacked_barplot/<int:upload_id>', methods=['GET'])
def species_reactivity_stacked_barplot(upload_id):
    try:
        top_n_species = int(request.args.get('top_n_species', 10))
    except ValueError:
        return jsonify({"error": "Invalid top_n_species parameter"}), 400

    # Fetch upload
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

    # Check required columns
    required_cols = {'taxon_species', 'sample_id', 'abundance'}
    if not required_cols.issubset(df.columns):
        return jsonify({"error": f"Missing required columns: {required_cols - set(df.columns)}"}), 400

    # Generate plot
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmpfile:
        try:
            return plot_species_rpk_stacked_barplot(df, top_n_species=top_n_species, output_path=tmpfile.name)
        except Exception as e:
            return jsonify({"error": str(e)}), 500

@visualisation_bp.route('/species_counts/filter/<int:upload_id>', methods=['GET'])
def filtered_species_rpk_heatmap(upload_id):
    virus_query = request.args.get('virus')
    if not virus_query:
        return jsonify({"error": "Missing 'virus' query parameter"}), 400

    # Fetch upload file
    with Session() as session:
        upload = session.get(Upload, upload_id)
        if not upload:
            return jsonify({"error": "Upload not found"}), 404
        filename = upload.name

    filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
    if not os.path.exists(filepath):
        return jsonify({"error": "File not found on server"}), 404

    # Load data
    try:
        df = pd.read_csv(filepath, sep=None, engine="python")
    except Exception as e:
        return jsonify({"error": f"Failed to read data: {str(e)}"}), 400

    # Check for required columns
    required_cols = {'taxon_species', 'sample_id', 'abundance'}
    if not required_cols.issubset(df.columns):
        return jsonify({"error": f"Missing required columns: {required_cols - set(df.columns)}"}), 400

    # Generate plot
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmpfile:
        try:
            return plot_filtered_species_rpk_heatmap(df, virus_query=virus_query, output_path=tmpfile.name)
        except Exception as e:
            return jsonify({"error": str(e)}), 500

@visualisation_bp.route('/antigen_map/<int:upload_id>', methods=['GET'])
def antigen_map(upload_id):
    try:
        win_size = int(request.args.get('win_size', 32))
        step_size = int(request.args.get('step_size', 4))
    except ValueError:
        return jsonify({"error": "Invalid window or step size parameter"}), 400

    # Fetch uploaded CSV file path from DB
    with Session() as session:
        upload = session.get(Upload, upload_id)
        if not upload:
            return jsonify({"error": "Upload not found"}), 404
        filename = upload.name

    filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
    if not os.path.exists(filepath):
        return jsonify({"error": "File not found on server"}), 404

    # Load main data CSV
    try:
        df = pd.read_csv(filepath, sep=None, engine='python')
    except Exception as e:
        return jsonify({"error": f"Failed to read data: {str(e)}"}), 400

    # Prepare cache folder for fasta and blast output
    cache_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'cache')
    os.makedirs(cache_dir, exist_ok=True)

    fasta_path = os.path.join(cache_dir, f"upload_{upload_id}_peptides.fasta")
    blast_output_path = os.path.join(cache_dir, f"upload_{upload_id}_blast_results.blast")

    # Blast DB path
    blast_db_prefix = os.path.join(BACKEND_ROOT, 'data', 'raw_data', 'blast_databases', 'coxsackievirusB1_P08291_db')
    if not os.path.exists(blast_db_prefix + ".pin"):
        return jsonify({"error": "BLAST database not found"}), 404

    try:
        # Step 1: Create and write the fasta file requred.
        write_antigen_map_fasta(df, fasta_path)

        # Step 2: Run blast on this fasta file and keep into a variable
        # once we read it.
        run_blastp(fasta_path, blast_db_prefix, blast_output_path)
        blast_df = read_blast(blast_output_path)

        # Step 3: Calculate the statistics.
        mean_rpk_diff_df = calculate_mean_rpk_difference(df, blast_df)
        moving_sum_df = calculate_moving_sum(mean_rpk_diff_df, win_size=win_size, step_size=step_size)

        # Step 4: Load EV polyprotein data.
        polyprotein_path = os.path.join(BACKEND_ROOT, 'data', 'raw_data', 'coxsackievirusB1_P08291.tsv')
        if not os.path.exists(polyprotein_path):
            return jsonify({"error": "Polyprotein metadata not found"}), 404
        ev_df = read_ev_polyprotein_uniprot_metadata(polyprotein_path)

        # Step 5: Plot the graph with the EV plot.
        return plot_antigen_map(moving_sum_df, ev_df=ev_df, output_path=None)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    