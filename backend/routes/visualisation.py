import os
import pandas as pd
from flask import Blueprint, current_app, jsonify, request, send_file
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
)
from utils.db import Session
from models.models import Upload, GraphText

BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
visualisation_bp = Blueprint('visualisation', __name__)

# ---------------- PNG Routes ----------------

@visualisation_bp.route('/species_counts/png/<int:upload_id>', methods=['GET'])
def species_counts_heatmap(upload_id):
    top_n_species = int(request.args.get('top_n_species', 20))
    with Session() as session:
        upload = session.get(Upload, upload_id)
        if not upload:
            return jsonify({"error": "Upload not found"}), 404
        df = pd.read_csv(os.path.join(current_app.config['UPLOAD_FOLDER'], upload.name), sep=None, engine="python")
    return plot_species_rpk_heatmap(df, top_n_species=top_n_species)

@visualisation_bp.route('/species_reactivity_stacked_barplot/png/<int:upload_id>', methods=['GET'])
def species_stacked_barplot(upload_id):
    top_n_species = int(request.args.get('top_n_species', 10))
    with Session() as session:
        upload = session.get(Upload, upload_id)
        if not upload:
            return jsonify({"error": "Upload not found"}), 404
        df = pd.read_csv(os.path.join(current_app.config['UPLOAD_FOLDER'], upload.name), sep=None, engine="python")
    return plot_species_rpk_stacked_barplot(df, top_n_species=top_n_species)

@visualisation_bp.route('/antigen_map/png/<int:upload_id>', methods=['GET'])
def antigen_map_png(upload_id):
    win_size = int(request.args.get('win_size', 32))
    step_size = int(request.args.get('step_size', 4))
    with Session() as session:
        upload = session.get(Upload, upload_id)
        if not upload:
            return jsonify({"error": "Upload not found"}), 404
        df = pd.read_csv(os.path.join(current_app.config['UPLOAD_FOLDER'], upload.name), sep=None, engine="python")

    cache_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'cache')
    os.makedirs(cache_dir, exist_ok=True)
    fasta_path = os.path.join(cache_dir, f"upload_{upload_id}_peptides.fasta")
    blast_output_path = os.path.join(cache_dir, f"upload_{upload_id}_blast_results.blast")
    blast_db_prefix = os.path.join(BACKEND_ROOT, 'data', 'raw_data', 'blast_databases', 'coxsackievirusB1_P08291_db')

    if not os.path.exists(blast_db_prefix + ".pin"):
        return jsonify({"error": "BLAST database not found"}), 404

    write_antigen_map_fasta(df, fasta_path)
    run_blastp(fasta_path, blast_db_prefix, blast_output_path)
    blast_df = read_blast(blast_output_path)
    mean_rpk_df = calculate_mean_rpk_difference(df, blast_df)
    moving_sum_df = calculate_moving_sum(mean_rpk_df, win_size=win_size, step_size=step_size)

    polyprotein_path = os.path.join(BACKEND_ROOT, 'data', 'raw_data', 'coxsackievirusB1_P08291.tsv')
    ev_df = read_ev_polyprotein_uniprot_metadata(polyprotein_path)

    return plot_antigen_map(moving_sum_df, ev_df=ev_df)

# ---------------- JSON Routes ----------------

@visualisation_bp.route('/species_counts/json/<int:upload_id>', methods=['GET'])
def species_counts_json(upload_id):
    top_n_species = int(request.args.get('top_n_species', 20))
    with Session() as session:
        upload = session.get(Upload, upload_id)
        if not upload:
            return jsonify({"error": "Upload not found"}), 404
        df = pd.read_csv(os.path.join(current_app.config['UPLOAD_FOLDER'], upload.name), sep=None, engine="python")
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
def species_stacked_barplot_json(upload_id):
    top_n_species = int(request.args.get('top_n_species', 10))
    with Session() as session:
        upload = session.get(Upload, upload_id)
        if not upload:
            return jsonify({"error": "Upload not found"}), 404
        df = pd.read_csv(os.path.join(current_app.config['UPLOAD_FOLDER'], upload.name), sep=None, engine="python")
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

# ---------------- Graph Text Routes ----------------

@visualisation_bp.route("/upload/<int:upload_id>/graph_text/<graph_type>", methods=['GET'])
def get_graph_text(upload_id, graph_type):
    with Session() as session:
        graph_text = session.query(GraphText).filter_by(upload_id=upload_id, graph_type=graph_type).first()
        return jsonify({"text": graph_text.text if graph_text else ""})

@visualisation_bp.route("/upload/<int:upload_id>/graph_text/<graph_type>", methods=['POST'])
def save_graph_text(upload_id, graph_type):
    data = request.get_json()
    text_value = data.get("text", "")
    with Session() as session:
        graph_text = session.query(GraphText).filter_by(upload_id=upload_id, graph_type=graph_type).first()
        if not graph_text:
            graph_text = GraphText(upload_id=upload_id, graph_type=graph_type, text=text_value)
            session.add(graph_text)
        else:
            graph_text.text = text_value
        session.commit()
    return jsonify({"message": "Graph text saved successfully"})

# ---------------- PDF Routes ----------------
@visualisation_bp.route("/generate_pdf/<int:upload_id>", methods=["POST"])
def generate_pdf_route(upload_id):
    import traceback
    payload = request.json
    if not payload:
        return {"error": "No payload provided"}, 400

    try:
        # DEBUG: print payload
        print(f"PDF generation payload: {payload}")

        pdf_buf = generate_pdf(upload_id, payload, app=current_app, return_buffer=True)
        return send_file(
            pdf_buf,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"upload_{upload_id}.pdf"
        )
    except Exception as e:
        # Print full traceback to console
        print("=== PDF Generation Error Traceback ===")
        traceback.print_exc()
        print("=====================================")

        return {"error": str(e)}, 500
