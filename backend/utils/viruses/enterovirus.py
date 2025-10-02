import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import pandas as pd
import numpy as np
import io
import tempfile
from flask import send_file, current_app
from utils.collections import init_r2_client, download_file_from_r2

# -----------------------
# Helper: load file from R2
# -----------------------
def load_file_from_r2(bucket_name, object_name, sep="\t"):
    r2_client = init_r2_client(current_app.config)
    with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
        temp_path = tmp_file.name
    if not download_file_from_r2(r2_client, bucket_name, object_name, temp_path):
        raise FileNotFoundError(f"Could not download {object_name} from R2")
    df = pd.read_csv(temp_path, sep=sep)
    return df

# -----------------------
# RPK helper for new datasets
# -----------------------
def compute_rpk(df, abundance_col='abundance', sample_col='sample_id'):
    df = df.copy()
    if abundance_col not in df.columns:
        # fallback: pick the first non-id numeric column as abundance
        numeric_cols = df.select_dtypes(include=np.number).columns.tolist()
        abundance_col = [c for c in numeric_cols if c != sample_col][0] if numeric_cols else abundance_col
    df['rpk'] = df.groupby(sample_col)[abundance_col].transform(lambda x: x / x.sum() * 1e5)
    return df

def normalize_coordinates(df):
    df['start'], df['end'] = np.minimum(df['start'], df['end']), np.maximum(df['start'], df['end'])
    return df

# -----------------------
# Wide-to-long helper for new dataset
# -----------------------
def melt_new_dataset(df):
    required_cols = {'u_pep_id', 'pep_id', 'pos_start', 'pos_end', 'UniProt_acc', 
                     'pep_aa', 'taxon_genus', 'taxon_species', 'gene_symbol', 'product'}
    if required_cols.issubset(df.columns):
        # Columns that are not metadata are sample measurements
        sample_cols = [c for c in df.columns if c not in required_cols]
        if sample_cols:
            # Ensure 'abundance' column does not exist yet
            if 'abundance' in df.columns:
                df = df.rename(columns={'abundance': 'abundance_orig'})
            df_long = df.melt(
                id_vars=list(required_cols),
                value_vars=sample_cols,
                var_name='sample_id',
                value_name='abundance'
            )
            return df_long
    return df

# -----------------------
# RPK difference calculation
# -----------------------
def calculate_mean_rpk_difference(df, blast_df, sample_id_col='sample_id', condition_col='Condition', pep_id_col='pep_id', abundance_col='abundance'):
    df = compute_rpk(df, abundance_col=abundance_col, sample_col=sample_id_col)
    df['mean_rpk_per_peptide'] = df.groupby([condition_col, pep_id_col])['rpk'].transform('mean')

    mean_rpk_cc = df.pivot_table(
        index=pep_id_col,
        columns=condition_col,
        values='mean_rpk_per_peptide',
        aggfunc='mean',
        fill_value=0
    ).reset_index()

    mean_rpk_cc.columns.name = None
    mean_rpk_cc = mean_rpk_cc.rename(columns={
        'Case': 'mean_rpk_per_pepCase',
        'Control': 'mean_rpk_per_pepControl'
    })

    mean_rpk_cc = mean_rpk_cc[
        (mean_rpk_cc['mean_rpk_per_pepCase'] != 0) |
        (mean_rpk_cc['mean_rpk_per_pepControl'] != 0)
    ]

    merged = blast_df.merge(mean_rpk_cc, left_on='seqid', right_on=pep_id_col, how='left')
    merged['mean_rpk_difference'] = merged['mean_rpk_per_pepCase'] - merged['mean_rpk_per_pepControl']
    merged = merged.dropna(subset=['mean_rpk_difference'])

    return merged[['seqid', 'start', 'end', 'mean_rpk_per_pepCase', 'mean_rpk_per_pepControl', 'mean_rpk_difference', 'saccver']]

# -----------------------
# Moving sum
# -----------------------
def calculate_moving_sum(df, value_column='mean_rpk_difference', win_size=4, step_size=1):
    rows = []
    for _, row in df.iterrows():
        start, end = row['start'], row['end']
        if (end - start + 1) >= win_size:
            for win_start in range(int(start), int(end - win_size + 2), step_size):
                win_end = win_start + win_size - 1
                overlap = df[(df['start'] <= win_start) & (df['end'] >= win_end)]
                moving_sum = overlap[value_column].sum()
                new_row = row.copy()
                new_row['window_start'] = win_start
                new_row['window_end'] = win_end
                new_row['moving_sum'] = moving_sum
                rows.append(new_row)
    return pd.DataFrame(rows)

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
    plt_obj.savefig(buf, format='png', dpi=300, bbox_inches='tight')
    plt_obj.close()
    buf.seek(0)
    return send_file(buf, mimetype="image/png")

# -----------------------
# Antigen map plotting
# -----------------------
def plot_antigen_map(moving_sum_df, ev_df=None, output_path=None):
    required_columns = {'window_start', 'window_end', 'moving_sum'}
    if not required_columns.issubset(moving_sum_df.columns):
        raise ValueError("DataFrame missing required columns for plotting")

    plot_df = moving_sum_df.drop_duplicates(subset=['window_start']).copy()
    plot_df['x_mid'] = (plot_df['window_start'] + plot_df['window_end']) / 2
    plot_df['Case'] = plot_df['moving_sum'].clip(lower=0)
    plot_df['Control'] = plot_df['moving_sum'].clip(upper=0)

    x_min, x_max = plot_df['window_start'].min(), plot_df['window_end'].max()
    x_full = np.arange(int(x_min), int(x_max) + 1)
    x_mid_int = plot_df['x_mid'].round().astype(int)

    case_series = pd.Series(0, index=x_full)
    ctrl_series = pd.Series(0, index=x_full)
    case_series.loc[x_mid_int] = plot_df['Case'].values.astype('int64')
    ctrl_series.loc[x_mid_int] = plot_df['Control'].values.astype('int64')

    fig, (ax1, ax2) = plt.subplots(nrows=2, figsize=(16, 10), gridspec_kw={'height_ratios': [1, 4]})

    if ev_df is not None and not ev_df.empty:
        protein_colours = {
            "VP4": "#428984", "VP2": "#6FC0EE", "VP3": "#26DED8E6", "VP1": "#C578E6",
            "2A": "#F6F4D6", "2B": "#D9E8E5", "2C": "#EBF5D8", "3AB": "#EDD9BA",
            "3C": "#EBD2D0", "3D": "#FFB19A"
        }
        for _, row in ev_df.iterrows():
            ax1.add_patch(patches.Rectangle(
                (row["start"], 0), row["end"] - row["start"], 0.1,
                facecolor=protein_colours.get(row["ev_proteins"], "#CCCCCC")
            ))
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
        ax1.set_xlim(x_min - 5, x_max + 5)
        ax1.set_ylim(-0.05, 0.15)
        ax1.axis("off")
    else:
        ax1.axis("off")

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

    return save_plot_to_file_or_buf(plt, output_path, download_name='antigen_map_cleaned.png')

# -----------------------
# EV Polyprotein TSV reading
# -----------------------
def read_ev_polyprotein_uniprot_metadata(tsv_path):
    df = pd.read_csv(tsv_path, sep="\t")
    overlapping_ev_proteins = [
        "P1", "Genome polyprotein", "Capsid protein VP0", "P2", "P3",
        "Protein 3A", "Viral protein genome-linked", "Protein 3CD"
    ]
    ev_proteins_list = ["VP4", "VP2", "VP3", "VP1", "2A", "2B", "2C", "3AB", "3C", "3D"]

    df = df.drop(columns=["Entry", "Reviewed"], errors="ignore")
    df = df.assign(Chain=df["Chain"].str.split("; CHAIN")).explode("Chain")
    df["start"] = df["Chain"].str.extract(r'(\d+)').astype(float)
    df["end"] = df["Chain"].str.extract(r'\.\.(\d+)').astype(float)
    df["note"] = df["Chain"].str.extract(r'/note="([^"]+)"')
    df["id"] = df["Chain"].str.extract(r'/id="([^"]+)"')
    df = df[~df["note"].isin(overlapping_ev_proteins)]

    pattern = "|".join(ev_proteins_list)
    df["ev_proteins"] = df["note"].str.extract(f"({pattern})")
    df["ev_proteins"] = df["ev_proteins"].fillna("3D")
    df["start"] = df["start"].replace(2, 1)

    df["protein_aa"] = df.apply(lambda row: row["Sequence"][int(row["start"]) - 1:int(row["end"])], axis=1)
    return df

# -----------------------
# Plot EV Polyprotein
# -----------------------
def plot_ev_polyprotein(ev_df, ax=None):
    protein_colours = {
        "VP4": "#428984", "VP2": "#6FC0EE", "VP3": "#26DED8E6", "VP1": "#C578E6",
        "2A": "#F6F4D6", "2B": "#D9E8E5", "2C": "#EBF5D8", "3AB": "#EDD9BA",
        "3C": "#EBD2D0", "3D": "#FFB19A"
    }

    if ax is None:
        fig, ax = plt.subplots(figsize=(16, 2))

    for _, row in ev_df.iterrows():
        ax.add_patch(patches.Rectangle(
            (row["start"], 0), row["end"] - row["start"], 0.1,
            facecolor=protein_colours.get(row["ev_proteins"], "#CCCCCC")
        ))
        ax.text(
            x=(row["start"] + row["end"]) / 2,
            y=0.05,
            s=row["ev_proteins"],
            va='center',
            ha='center',
            fontsize=8,
            fontweight='bold',
            family='Verdana'
        )

    all_starts = ev_df["start"].tolist()
    all_ends = ev_df["end"].tolist()

    for x in all_starts + all_ends:
        ax.plot([x, x], [0, 0.1], color="black", linewidth=0.2)
    ax.hlines(0, min(all_starts), max(all_ends), colors="black", linewidth=0.5)
    ax.hlines(0.1, min(all_starts), max(all_ends), colors="black", linewidth=0.5)

    ax.text(min(all_starts) - 5, 0.05, "5'", ha='right', va='center', fontsize=8)
    ax.text(max(all_ends) + 5, 0.05, "3'", ha='left', va='center', fontsize=8)

    ax.set_xlim(min(all_starts) - 10, max(all_ends) + 10)
    ax.set_ylim(-0.05, 0.15)
    ax.axis("off")
    return ax
