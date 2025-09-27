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
    prepare_antigen_map_df,  # <-- new helper
)
from utils.db import Session
from models.models import Upload, GraphText
from routes.auth import jwt_required

BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
visualisation_bp = Blueprint('visualisation', __name__)

# ---------------- PNG Routes ----------------

@visualisation_bp.route('/species_counts/png/<int:upload_id>', methods=['GET'])
@jwt_required
def species_counts_heatmap(upload_id):
    user_id = g.current_user_id
    top_n_species = int(request.args.get('top_n_species', 20))
    with Session() as session:
        upload = session.get(Upload, upload_id)
        if not upload:
            return jsonify({"error": "Upload not found"}), 404
        if upload.user_id != user_id:
            return jsonify({"error": "Forbidden"}), 403
        df = pd.read_csv(os.path.join(current_app.config['UPLOAD_FOLDER'], upload.name), sep=None, engine="python")
    return plot_species_rpk_heatmap(df, top_n_species=top_n_species)

@visualisation_bp.route('/species_reactivity_stacked_barplot/png/<int:upload_id>', methods=['GET'])
@jwt_required
def species_stacked_barplot(upload_id):
    user_id = g.current_user_id
    top_n_species = int(request.args.get('top_n_species', 10))
    with Session() as session:
        upload = session.get(Upload, upload_id)
        if not upload:
            return jsonify({"error": "Upload not found"}), 404
        if upload.user_id != user_id:
            return jsonify({"error": "Forbidden"}), 403
        df = pd.read_csv(os.path.join(current_app.config['UPLOAD_FOLDER'], upload.name), sep=None, engine="python")
    return plot_species_rpk_stacked_barplot(df, top_n_species=top_n_species)

@visualisation_bp.route('/antigen_map/png/<int:upload_id>', methods=['GET'])
@jwt_required
def antigen_map_png(upload_id):
    user_id = g.current_user_id
    win_size = int(request.args.get('win_size', 32))
    step_size = int(request.args.get('step_size', 4))

    with Session() as session:
        upload = session.get(Upload, upload_id)
        if not upload:
            return jsonify({"error": "Upload not found"}), 404
        if upload.user_id != user_id:
            return jsonify({"error": "Forbidden"}), 403
        df = pd.read_csv(os.path.join(current_app.config['UPLOAD_FOLDER'], upload.name), sep=None, engine="python")

    # Use the new helper
    moving_sum_df, ev_df = prepare_antigen_map_df(upload_id, df, win_size, step_size, app=current_app)
    return plot_antigen_map(moving_sum_df, ev_df=ev_df)

# ---------------- JSON Routes ----------------

@visualisation_bp.route('/species_counts/json/<int:upload_id>', methods=['GET'])
@jwt_required
def species_counts_json(upload_id):
    user_id = g.current_user_id
    top_n_species = int(request.args.get('top_n_species', 20))
    with Session() as session:
        upload = session.get(Upload, upload_id)
        if not upload:
            return jsonify({"error": "Upload not found"}), 404
        if upload.user_id != user_id:
            return jsonify({"error": "Forbidden"}), 403
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
@jwt_required
def species_stacked_barplot_json(upload_id):
    user_id = g.current_user_id
    top_n_species = int(request.args.get('top_n_species', 10))
    with Session() as session:
        upload = session.get(Upload, upload_id)
        if not upload:
            return jsonify({"error": "Upload not found"}), 404
        if upload.user_id != user_id:
            return jsonify({"error": "Forbidden"}), 403
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
        upload = session.get(Upload, upload_id)
        if not upload:
            return jsonify({
                "moving_sum": [], "window_start": [], "window_end": [], "ev_domains": [],
                "error": "Upload not found"
            }), 404
        if upload.user_id != user_id:
            return jsonify({"moving_sum": [], "window_start": [], "window_end": [], "ev_domains": [], "error": "Forbidden"}), 403
        df = pd.read_csv(os.path.join(current_app.config['UPLOAD_FOLDER'], upload.name), sep=None, engine="python")

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

    with Session() as session:
        upload = session.get(Upload, upload_id)
        if not upload:
            return {"error": "Upload not found"}, 404
        if upload.user_id != user_id:
            return {"error": "Forbidden"}, 403

    import traceback
    try:
        print(f"PDF generation payload: {payload}")
        graphs = payload.get("graphs", [])
        if not graphs:
            return {"error": "No graphs specified for PDF generation"}, 400

        # Load upload CSV once
        upload_path = os.path.join(current_app.config['UPLOAD_FOLDER'], upload.name)
        df = pd.read_csv(upload_path, sep=None, engine="python")

        from fpdf import FPDF
        pdf = FPDF()
        pdf.set_auto_page_break(auto=True, margin=15)

        def get_graph_text(graph_type):
            with Session() as session:
                gt = session.query(GraphText).filter_by(upload_id=upload_id, graph_type=graph_type).first()
                return gt.text if gt else ""

        def resp_to_pngfile(resp_bytes):
            import tempfile
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

                # Use the new helper to avoid repeating BLAST/FASTA logic
                moving_sum_df, ev_df = prepare_antigen_map_df(upload_id, df, win_size, step_size, app=current_app)
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

        pdf_buf = io.BytesIO(pdf.output(dest='S').encode('latin1'))
        pdf_buf.seek(0)
        return send_file(
            pdf_buf,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"upload_{upload_id}.pdf"
        )

    except Exception as e:
        print("=== PDF Generation Error Traceback ===")
        traceback.print_exc()
        print("=====================================")
        return {"error": str(e)}, 500
