import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import pandas as pd
import numpy as np
import io
import tempfile
import os
import subprocess
from flask import send_file, current_app

# -----------------------
# Helper: load file from R2
# -----------------------
from utils.collections import init_r2_client, download_file_from_r2

def load_file_from_r2(bucket_name, object_name, sep="\t"):
    r2_client = init_r2_client(current_app)
    with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
        temp_path = tmp_file.name
    if not download_file_from_r2(r2_client, bucket_name, object_name, temp_path):
        raise FileNotFoundError(f"Could not download {object_name} from R2")
    df = pd.read_csv(temp_path, sep=sep)
    return df

# -----------------------
# Generate temporary FASTA for DIAMOND short
# -----------------------
def generate_temp_fasta_from_peptides(peptide_df, pep_id_col='pep_id', pep_seq_col='pep_aa'):
    temp_fasta = tempfile.NamedTemporaryFile(mode='w+', delete=False, suffix='.fasta')
    for _, row in peptide_df.iterrows():
        header = str(row[pep_id_col])
        seq = str(row[pep_seq_col])
        temp_fasta.write(f">{header}\n{seq}\n")
    temp_fasta.flush()
    temp_fasta.close()
    return temp_fasta.name

# -----------------------
# Run DIAMOND / BLAST
# -----------------------
def run_diamond(query_fasta, db_path, output_path, threads=4, evalue=0.01):
    cmd = [
        "diamond", "blastp",
        "--query", query_fasta,
        "--db", db_path,
        "--out", output_path,
        "--outfmt", "6",
        "--threads", str(threads),
        "--evalue", str(evalue)
    ]
    try:
        subprocess.run(cmd, check=True)
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"DIAMOND command failed: {e}") from e
    return output_path

# -----------------------
# Helper: calculate mean RPK difference
# -----------------------
def calculate_mean_rpk_difference(df, pep_col='pep_id', cond_col='Condition', rpk_col='rpk'):
    mean_rpk = df.groupby([pep_col, cond_col])[rpk_col].mean().reset_index()
    pivot_df = mean_rpk.pivot(index=pep_col, columns=cond_col, values=rpk_col).fillna(0)
    for c in ['Case', 'Control']:
        if c not in pivot_df.columns:
            pivot_df[c] = 0
    pivot_df['mean_rpk_difference'] = pivot_df['Case'] - pivot_df['Control']
    pivot_df = pivot_df.reset_index().rename(columns={'Case': 'mean_rpk_case', 'Control': 'mean_rpk_control'})
    return pivot_df

# -----------------------
# Compute moving sum
# -----------------------
def calculate_moving_sum(df, value_column='mean_rpk_difference', win_size=32, step_size=4):
    if not {'sstart', 'send', value_column}.issubset(df.columns):
        raise ValueError(f"Missing required columns for moving sum: 'sstart', 'send', '{value_column}'")
    min_start = int(df['sstart'].min())
    max_end = int(df['send'].max())
    window_starts = np.arange(min_start, max_end - win_size + 2, step_size)
    moving_rows = []
    for ws in window_starts:
        we = ws + win_size - 1
        mask = (df['sstart'] <= ws) & (df['send'] >= we)
        if mask.any():
            tmp = df.loc[mask].copy()
            tmp['window_start'] = ws
            tmp['window_end'] = we
            tmp['moving_sum'] = tmp[value_column].sum()
            moving_rows.append(tmp)
    if moving_rows:
        return pd.concat(moving_rows, ignore_index=True)
    else:
        return pd.DataFrame(columns=list(df.columns) + ['window_start', 'window_end', 'moving_sum'])

# -----------------------
# Plot antigen map
# -----------------------
def plot_antigen_map(moving_sum_df, ev_df=None, output_path=None):
    import matplotlib.pyplot as plt
    import matplotlib.patches as patches
    import pandas as pd
    import numpy as np
    import io
    from flask import send_file

    # Ensure required columns exist
    required_cols = {'window_start', 'window_end', 'moving_sum'}
    if not required_cols.issubset(moving_sum_df.columns):
        raise ValueError(f"DataFrame missing required columns for plotting: {required_cols}")

    # Prepare moving sum data
    plot_df = moving_sum_df.drop_duplicates(subset=['window_start']).copy()
    plot_df['x_mid'] = (plot_df['window_start'] + plot_df['window_end']) / 2
    plot_df['Case'] = plot_df['moving_sum'].clip(lower=0)
    plot_df['Control'] = plot_df['moving_sum'].clip(upper=0)

    x_min, x_max = plot_df['window_start'].min(), plot_df['window_end'].max()
    x_full = np.arange(int(x_min), int(x_max) + 1)
    x_mid_int = plot_df['x_mid'].round().astype(int)

    case_series = pd.Series(0, index=x_full)
    ctrl_series = pd.Series(0, index=x_full)
    case_series.update(pd.Series(plot_df['Case'].values.astype('float'), index=x_mid_int))
    ctrl_series.update(pd.Series(plot_df['Control'].values.astype('float'), index=x_mid_int))

    # Create figure
    fig, (ax1, ax2) = plt.subplots(nrows=2, figsize=(16, 10), gridspec_kw={'height_ratios': [1, 4]})

    # Plot EV polyprotein domains
    if ev_df is not None and not ev_df.empty:
        protein_colours = {
            "VP4": "#428984",
            "VP2": "#6FC0EE",
            "VP3": "#26DED8E6",
            "VP1": "#C578E6",
            "2A": "#F6F4D6",
            "2B": "#D9E8E5",
            "2C": "#EBF5D8",
            "3AB": "#EDD9BA",
            "3C": "#EBD2D0",
            "3D": "#FFB19A"
        }

        # Draw domain rectangles
        for _, row in ev_df.iterrows():
            ax1.add_patch(patches.Rectangle(
                (row["start"], 0), row["end"] - row["start"], 0.1,
                facecolor=protein_colours.get(row["ev_proteins"], "#CCCCCC")
            ))

        # Add domain labels only if wide enough
        for _, row in ev_df.iterrows():
            width = row["end"] - row["start"]
            if width >= 20:
                ax1.text(
                    x=(row["start"] + row["end"]) / 2,
                    y=0.05,
                    s=row["ev_proteins"],
                    va='center',
                    ha='center',
                    fontsize=8,
                    fontweight='bold',
                    family='Verdana'
                )

        # Add 5' and 3' annotations
        ax1.annotate("5'", xy=(x_min, 0.05), xycoords='data', ha='left', fontsize=10, fontweight='bold')
        ax1.annotate("3'", xy=(x_max, 0.05), xycoords='data', ha='right', fontsize=10, fontweight='bold')

        ax1.set_xlim(x_min - 5, x_max + 5)
        ax1.set_ylim(0, 0.2)
        ax1.axis("off")
    else:
        ax1.axis("off")

    # Plot moving sum antigen map
    ax2.fill_between(case_series.index, case_series.values, color='#d73027', label='Case')
    ax2.fill_between(ctrl_series.index, ctrl_series.values, color='#4575b4', label='Control')
    ax2.axhline(0, color='black', linewidth=0.5)
    ax2.set_xlim(x_min - 5, x_max + 5)
    ax2.set_title("Antigen Map: Moving Sum of RPK Differences", fontsize=16)
    ax2.set_xlabel("Position in sequence (amino acids)", fontsize=14)
    ax2.set_ylabel("Moving Sum", fontsize=14)
    ax2.legend(loc='upper right')
    ax2.grid(False)
    plt.subplots_adjust(hspace=0.1)

    # Save or return image
    if output_path:
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        plt.close()
        return send_file(output_path, mimetype='image/png', as_attachment=False)

    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=300, bbox_inches='tight')
    plt.close()
    buf.seek(0)
    return send_file(buf, mimetype="image/png")

# -----------------------
# Parse EV polyprotein domains from UniProt TSV
# -----------------------
def parse_ev_domains_from_tsv(tsv_path, merge_3AB=True):
    import pandas as pd
    import re

    df = pd.read_csv(tsv_path, sep="\t")

    # Split multiple chains
    df = df.assign(Chain=df["Chain"].str.split("; CHAIN")).explode("Chain")

    # Extract start, end, note, id
    df["start"] = df["Chain"].str.extract(r"(\d+)\.\.").astype(int)
    df["end"] = df["Chain"].str.extract(r"\.\.(\d+)").astype(int)
    df["note"] = df["Chain"].str.extract(r'/note="([^"]+)"')
    df["id"] = df["Chain"].str.extract(r'/id="([^"]+)"')

    # Filter out overlapping proteins
    overlapping_proteins = [
        "P1", "Genome polyprotein", "Capsid protein VP0", "P2", "P3",
        "Protein 3A", "Viral protein genome-linked", "Protein 3CD"
    ]
    df = df[~df["note"].isin(overlapping_proteins)]

    # Map to standard EV proteins
    ev_proteins_ref = ["VP4", "VP2", "VP3", "VP1", "2A", "2B", "2C", "3AB", "3C", "3D"]

    def map_ev_protein(note):
        if pd.isna(note):
            return None
        for p in ev_proteins_ref:
            if p in note:
                return p
        if "3D" in note or "RNA-directed RNA polymerase" in note:
            return "3D"
        return None

    df["ev_proteins"] = df["note"].apply(map_ev_protein)

    # Add protein sequence column if Sequence exists
    if "Sequence" in df.columns:
        df["protein_aa"] = df.apply(lambda r: r["Sequence"][r["start"] - 1:r["end"]], axis=1)
    else:
        df["protein_aa"] = ""

    # Merge 3A + 3B → 3AB without touching 3D
    if merge_3AB:
        df_3A = df[df["ev_proteins"] == "3A"]
        df_3B = df[df["ev_proteins"] == "3B"]
        if not df_3A.empty and not df_3B.empty:
            start_3A = df_3A["start"].min()
            end_3B = df_3B["end"].max()
            seq_3AB = "".join(df_3A["protein_aa"].tolist() + df_3B["protein_aa"].tolist())
            new_row = pd.DataFrame([{
                "ev_proteins": "3AB",
                "start": start_3A,
                "end": end_3B,
                "protein_aa": seq_3AB
            }])
            df = df[~df["ev_proteins"].isin(["3A", "3B"])]
            # Insert 3AB in order
            idx_3C = df[df["ev_proteins"] == "3C"].index
            if len(idx_3C):
                df = pd.concat([df.iloc[:idx_3C[0]], new_row, df.iloc[idx_3C[0]:]], ignore_index=True)
            else:
                df = pd.concat([df, new_row], ignore_index=True)

    df = df[["ev_proteins", "start", "end", "protein_aa"]].sort_values("start").reset_index(drop=True)
    return df

# -----------------------
# Prepare antigen map DataFrame
# -----------------------
def prepare_antigen_map_df(upload_id, df, diamond_db_path,
                           win_size=32, step_size=4, cache_folder=None, tsv_path=None):
    cache_folder = cache_folder or tempfile.gettempdir()
    os.makedirs(cache_folder, exist_ok=True)

    debug_fasta_path = os.path.join(
        current_app.root_path,
        "uploads", "cache",
        f"debug_upload_{upload_id}.fasta"
    )
    temp_fasta_path = generate_temp_fasta_from_peptides(df, pep_id_col='pep_id', pep_seq_col='pep_aa')
    
    # Copy temp FASTA to debug location
    import shutil
    os.makedirs(os.path.dirname(debug_fasta_path), exist_ok=True)
    shutil.copy(temp_fasta_path, debug_fasta_path)
    print(f"DEBUG: FASTA saved to {debug_fasta_path} for inspection")

    temp_diamond_output = tempfile.NamedTemporaryFile(delete=False, suffix='.tsv')
    temp_diamond_output.close()

    try:
        run_diamond(temp_fasta_path, diamond_db_path, temp_diamond_output.name)
        blast_df = pd.read_csv(
            temp_diamond_output.name,
            sep="\t",
            names=["qseqid", "sseqid", "pident", "length", "mismatch", "gapopen",
                   "qstart", "qend", "sstart", "send", "evalue", "bitscore"]
        )
    finally:
        os.remove(temp_fasta_path)
        os.remove(temp_diamond_output.name)

    df = df.copy()
    df['rpk'] = df.groupby('sample_id')['abundance'].transform(lambda x: x / x.sum() * 1e5)

    mean_diff_df = calculate_mean_rpk_difference(df)
    merged = blast_df.merge(mean_diff_df, left_on='qseqid', right_on='pep_id', how='left')

    merged['sstart'] = merged['sstart'].astype(int)
    merged['send'] = merged['send'].astype(int)

    moving_sum_df = calculate_moving_sum(
        merged, value_column='mean_rpk_difference', win_size=win_size, step_size=step_size
    )

    if tsv_path is None:
        tsv_path = os.path.join(current_app.root_path, "data", "coxsackievirusB1_P08291.tsv")
    ev_df = parse_ev_domains_from_tsv(tsv_path)

    return moving_sum_df, ev_df, debug_fasta_path
    