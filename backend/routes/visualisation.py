import io
import os
import pandas as pd
from flask import Blueprint, current_app, jsonify, request, send_file, g
from utils.visualisation import (
    compute_rpk,
    plot_species_rpk_heatmap,
    plot_species_rpk_stacked_barplot,
    plot_antigen_map,
    write_antigen_map_fasta,
    run_blastp,
    read_blast,
    calculate_mean_rpk_difference,
    calculate_moving_sum,
    read_ev_polyprotein_uniprot_metadata,
    generate_pdf,
    prepare_antigen_map_df,
)
from utils.db import Session
from models.models import Upload, GraphText
from routes.auth import jwt_required
from utils.r2 import fetch_upload_from_r2

visualisation_bp = Blueprint('visualisation', __name__)

# ---------------- Helper to load upload from R2 ----------------
def load_upload_csv(upload):
    """Fetch CSV from R2 and return as pandas DataFrame."""
    file_bytes = fetch_upload_from_r2(upload.name)
    return pd.read_csv(io.BytesIO(file_bytes), sep=None, engine="python")

# ---------------- Helper to check upload permissions ----------------
def get_upload_or_forbidden(session, upload_id, user_id):
    upload = session.get(Upload, upload_id)
    if not upload:
        return None, jsonify({"error": "Upload not found"}), 404
    if upload.user_id != user_id:
        return None, jsonify({"error": "Forbidden"}), 403
    return upload, None, None

# ---------------- PNG Routes ----------------
@visualisation_bp.route('/species_counts/png/<int:upload_id>', methods=['GET'])
@jwt_required
def species_counts_heatmap(upload_id):
    user_id = g.current_user_id
    top_n_species = int(request.args.get('top_n_species', 20))
    with Session() as session:
        upload, err_resp, status = get_upload_or_forbidden(session, upload_id, user_id)
        if err_resp:
            return err_resp, status
    df = load_upload_csv(upload)
    return plot_species_rpk_heatmap(df, top_n_species=top_n_species)

@visualisation_bp.route('/species_reactivity_stacked_barplot/png/<int:upload_id>', methods=['GET'])
@jwt_required
def species_stacked_barplot(upload_id):
    user_id = g.current_user_id
    top_n_species = int(request.args.get('top_n_species', 10))
    with Session() as session:
        upload, err_resp, status = get_upload_or_forbidden(session, upload_id, user_id)
        if err_resp:
            return err_resp, status
    df = load_upload_csv(upload)
    return plot_species_rpk_stacked_barplot(df, top_n_species=top_n_species)

@visualisation_bp.route('/antigen_map/png/<int:upload_id>', methods=['GET'])
@jwt_required
def antigen_map_png(upload_id):
    user_id = g.current_user_id
    win_size = int(request.args.get('win_size', 32))
    step_size = int(request.args.get('step_size', 4))
    with Session() as session:
        upload, err_resp, status = get_upload_or_forbidden(session, upload_id, user_id)
        if err_resp:
            return err_resp, status
    df = load_upload_csv(upload)
    moving_sum_df, ev_df = prepare_antigen_map_df(upload_id, df, win_size, step_size, app=current_app)
    return plot_antigen_map(moving_sum_df, ev_df=ev_df)

# ---------------- JSON Routes ----------------
@visualisation_bp.route('/species_counts/json/<int:upload_id>', methods=['GET'])
@jwt_required
def species_counts_json(upload_id):
    user_id = g.current_user_id
    top_n_species = int(request.args.get('top_n_species', 20))
    with Session() as session:
        upload, err_resp, status = get_upload_or_forbidden(session, upload_id, user_id)
        if err_resp:
            return err_resp, status
    df = load_upload_csv(upload)
    df = compute_rpk(df)
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

@visualisation_bp.route('/species_reactivity_stacked_barplot/json/<int:upload_id>', methods=['GET'])
@jwt_required
def species_stacked_barplot_json(upload_id):
    user_id = g.current_user_id
    top_n_species = int(request.args.get('top_n_species', 10))
    with Session() as session:
        upload, err_resp, status = get_upload_or_forbidden(session, upload_id, user_id)
        if err_resp:
            return err_resp, status
    df = load_upload_csv(upload)
    df = compute_rpk(df)
    grouped = df.groupby(['taxon_species', 'sample_id'])['rpk'].mean().reset_index()
    pivot_df = grouped.pivot(index='sample_id', columns='taxon_species', values='rpk').fillna(0)
    top_species = pivot_df.sum(axis=0).nlargest(top_n_species).index
    pivot_df = pivot_df[top_species]
    return jsonify({
        "samples": list(pivot_df.index),
        "species": list(pivot_df.columns),
        "values": pivot_df.values.tolist()
    })

@visualisation_bp.route('/antigen_map/json/<int:upload_id>', methods=['GET'])
@jwt_required
def antigen_map_json(upload_id):
    user_id = g.current_user_id
    try:
        win_size = int(request.args.get('win_size', 32))
        step_size = int(request.args.get('step_size', 4))
    except ValueError:
        return jsonify({
            "moving_sum": [], "window_start": [], "window_end": [], "ev_domains": [],
            "error": "Invalid window or step size parameter"
        }), 400

    with Session() as session:
        upload, err_resp, status = get_upload_or_forbidden(session, upload_id, user_id)
        if err_resp:
            return jsonify({
                "moving_sum": [], "window_start": [], "window_end": [], "ev_domains": [],
                "error": "Upload not found" if status==404 else "Forbidden"
            }), status

    df = load_upload_csv(upload)
    try:
        moving_sum_df, ev_df = prepare_antigen_map_df(upload_id, df, win_size, step_size, app=current_app)
        json_data = {
            "moving_sum": moving_sum_df['moving_sum'].tolist() if not moving_sum_df.empty else [],
            "window_start": moving_sum_df['window_start'].tolist() if not moving_sum_df.empty else [],
            "window_end": moving_sum_df['window_end'].tolist() if not moving_sum_df.empty else [],
            "ev_domains": ev_df[['start', 'end', 'ev_proteins']].to_dict(orient='records') if not ev_df.empty else []
        }
        return jsonify(json_data)
    except Exception as e:
        return jsonify({
            "moving_sum": [], "window_start": [], "window_end": [], "ev_domains": [],
            "error": f"Antigen map generation failed: {str(e)}"
        }), 500

# ---------------- Graph Text Routes ----------------
@visualisation_bp.route("/upload/<int:upload_id>/graph_text/<graph_type>", methods=['GET'])
@jwt_required
def get_graph_text(upload_id, graph_type):
    user_id = g.current_user_id
    with Session() as session:
        graph_text = session.query(GraphText).filter_by(upload_id=upload_id, graph_type=graph_type).first()
        if graph_text and hasattr(graph_text, 'upload') and graph_text.upload.user_id != user_id:
            return jsonify({"error": "Forbidden"}), 403
        return jsonify({"text": graph_text.text if graph_text else ""})

@visualisation_bp.route("/upload/<int:upload_id>/graph_text/<graph_type>", methods=['POST'])
@jwt_required
def save_graph_text(upload_id, graph_type):
    user_id = g.current_user_id
    data = request.get_json()
    text_value = data.get("text", "")
    with Session() as session:
        graph_text = session.query(GraphText).filter_by(upload_id=upload_id, graph_type=graph_type).first()
        if graph_text and hasattr(graph_text, 'upload') and graph_text.upload.user_id != user_id:
            return jsonify({"error": "Forbidden"}), 403
        if not graph_text:
            graph_text = GraphText(upload_id=upload_id, graph_type=graph_type, text=text_value)
            session.add(graph_text)
        else:
            graph_text.text = text_value
        session.commit()
    return jsonify({"message": "Graph text saved successfully"})

# ---------------- PDF Routes ----------------
@visualisation_bp.route("/generate_pdf/<int:upload_id>", methods=["POST"])
@jwt_required
def generate_pdf_route(upload_id):
    user_id = g.current_user_id
    payload = request.json
    if not payload:
        return {"error": "No payload provided"}, 400
    try:
        pdf_buf = generate_pdf(upload_id, payload, app=current_app, return_buffer=True)
        return send_file(
            pdf_buf,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"upload_{upload_id}.pdf"
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}, 500
