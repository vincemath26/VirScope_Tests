import os
import pandas as pd
from flask import Blueprint, jsonify, current_app, request
from utils.db import Session
from models.models import Upload, GraphText
from sqlalchemy.exc import SQLAlchemyError
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
    # your existing antigen map logic here (unchanged)
    pass


# --- Graph Text GET ---
@visualisation_bp.route("/upload/<int:upload_id>/graph_text/<graph_type>", methods=['GET'])
def get_graph_text(upload_id, graph_type):
    try:
        with Session() as session:
            graph_text = session.query(GraphText).filter_by(
                upload_id=upload_id,
                graph_type=graph_type
            ).first()
            text_value = graph_text.text if graph_text else ""
            return jsonify({"text": text_value}), 200
    except SQLAlchemyError as e:
        return jsonify({"error": str(e)}), 500


# --- Graph Text POST ---
@visualisation_bp.route("/upload/<int:upload_id>/graph_text/<graph_type>", methods=['POST'])
def save_graph_text(upload_id, graph_type):
    try:
        data = request.get_json()
        if not data or "text" not in data:
            return jsonify({"error": "Missing 'text' in request body"}), 400

        text_value = data["text"]

        with Session() as session:
            upload = session.get(Upload, upload_id)
            if not upload:
                return jsonify({"error": "Upload not found"}), 404

            graph_text = session.query(GraphText).filter_by(
                upload_id=upload_id,
                graph_type=graph_type
            ).first()

            if not graph_text:
                graph_text = GraphText(upload_id=upload_id, graph_type=graph_type, text=text_value)
                session.add(graph_text)
            else:
                graph_text.text = text_value

            session.commit()

        return jsonify({"message": "Graph text saved successfully"}), 200

    except SQLAlchemyError as e:
        return jsonify({"error": str(e)}), 500
