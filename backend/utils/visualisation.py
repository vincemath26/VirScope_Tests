import subprocess
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import seaborn as sns
import pandas as pd
import numpy as np
import io
from flask import send_file

def compute_rpk(df, abundance_col='abundance', sample_col='sample_id'):
    df = df.copy()
    df['rpk'] = df.groupby(sample_col)[abundance_col].transform(lambda x: x / x.sum() * 1e5)
    return df

def plot_species_rpk_heatmap(df, top_n_species=20, output_path=None):
    # Compute rpk
    df = compute_rpk(df)

    # Filter out NA values
    df = df.dropna(subset=['taxon_species', 'sample_id', 'rpk'])

    # Group and pivot
    grouped = df.groupby(['taxon_species', 'sample_id'])['rpk'].sum().reset_index()
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

def plot_filtered_species_rpk_heatmap(df, virus_query, output_path=None):
    # Compute rpk
    df = compute_rpk(df)

    # Filter valid data
    df = df.dropna(subset=['taxon_species', 'sample_id', 'rpk'])

    # Case-insensitive species filtering by virus_query
    mask = df['taxon_species'].str.contains(virus_query, case=False, na=False)
    filtered_df = df[mask]

    if filtered_df.empty:
        raise ValueError(f"No species match the virus query: '{virus_query}'")

    # Group and pivot for heatmap
    grouped = filtered_df.groupby(['taxon_species', 'sample_id'])['rpk'].sum().reset_index()
    heatmap_data = grouped.pivot(index='taxon_species', columns='sample_id', values='rpk').fillna(0)

    # Sort sample columns alphabetically
    heatmap_data = heatmap_data[sorted(heatmap_data.columns)]

    # Plot
    plt.figure(figsize=(18, 10))
    sns.heatmap(heatmap_data, cmap="magma", annot=False, cbar_kws={'label': 'Total Peptide RPK'})
    plt.title(f"Filtered Species Heatmap for '{virus_query}'")
    plt.xlabel("Sample ID")
    plt.ylabel("Matching Species")
    plt.tight_layout()

    # Save or return
    if output_path:
        plt.savefig(output_path)
        plt.close()
        return send_file(output_path, mimetype='image/png', as_attachment=False, download_name='filtered_species_rpk_heatmap.png')

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

    # Optionally, drop duplicates
    df = df.drop_duplicates()

    return df

# Translated Legana's R Code.
# I don't know if I actually did this correctly.
def calculate_mean_rpk_difference(df, blast_df, sample_id_col='sample_id', condition_col='Condition', pep_id_col='pep_id', abundance_col='abundance'):
    # Compute RPK per sample
    df = df.copy()
    df['rpk'] = df.groupby(sample_id_col)[abundance_col].transform(lambda x: x / x.sum() * 100000)

    # Compute mean RPK per condition + peptide
    df['mean_rpk_per_peptide'] = df.groupby([condition_col, pep_id_col])['rpk'].transform('mean')

    # Pivot to get case and control means
    mean_rpk_cc = df.pivot_table(
        index=pep_id_col,
        columns=condition_col,
        values='mean_rpk_per_peptide',
        aggfunc='mean',
        fill_value=0
    ).reset_index()

    # Rename columns
    # Remove pandas’ pivot table naming
    mean_rpk_cc.columns.name = None  
    mean_rpk_cc = mean_rpk_cc.rename(columns={
        'Case': 'mean_rpk_per_pepCase',
        'Control': 'mean_rpk_per_pepControl'
    })

    # Remove rows where both values are zero
    mean_rpk_cc = mean_rpk_cc[(mean_rpk_cc['mean_rpk_per_pepCase'] != 0) | (mean_rpk_cc['mean_rpk_per_pepControl'] != 0)]

    # Join with BLAST data on peptide ID (qaccver in blast)
    merged = blast_df.merge(mean_rpk_cc, left_on='qaccver', right_on=pep_id_col, how='left')

    # Calculate difference
    merged['mean_rpk_difference'] = merged['mean_rpk_per_pepCase'] - merged['mean_rpk_per_pepControl']

    # Drop rows with NA differences
    merged = merged.dropna(subset=['mean_rpk_difference'])

    # Final columns
    return merged[['qaccver', 'sstart', 'send', 'mean_rpk_per_pepCase', 'mean_rpk_per_pepControl', 'mean_rpk_difference', 'saccver']].rename(columns={
        'qaccver': 'seqid',
        'sstart': 'start',
        'send': 'end'
    })

# Translated Legana's R Code.
# I had to look at my notes from ENGG1811 because
# I remember I actually had to do a moving sum function
# for my assignment 2.
# I remember using this as a guide as well:
# https://stackoverflow.com/questions/12709853/python-running-cumulative-sum-with-a-given-window
def calculate_moving_sum(df, value_column='mean_rpk_difference', win_size=4, step_size=1):
    rows = []

    for _, row in df.iterrows():
        start, end = row['start'], row['end']
        if (end - start + 1) >= win_size:
            for win_start in range(start, end - win_size + 2, step_size):
                win_end = win_start + win_size - 1
                # Calculate sum of values overlapping this window
                overlap = df[(df['start'] <= win_start) & (df['end'] >= win_end)]
                moving_sum = overlap[value_column].sum()
                new_row = row.copy()
                new_row['window_start'] = win_start
                new_row['window_end'] = win_end
                new_row['moving_sum'] = moving_sum
                rows.append(new_row)

    return pd.DataFrame(rows)

# Actually plotting the map
# Updated with EV plot
def plot_antigen_map(moving_sum_df, ev_df=None, output_path=None):
    import matplotlib.patches as patches

    required_columns = {'window_start', 'window_end', 'moving_sum'}
    if not required_columns.issubset(moving_sum_df.columns):
        raise ValueError("DataFrame missing required columns for plotting")

    # Drop duplicates per window to avoid stacking
    plot_df = moving_sum_df.drop_duplicates(subset=['window_start']).copy()

    # Compute midpoint for bar positions
    plot_df['x_mid'] = (plot_df['window_start'] + plot_df['window_end']) / 2

    # Assign condition based on sign of moving sum
    plot_df['Condition'] = np.where(plot_df['moving_sum'] > 0, 'Case', 'Control')

    # Define consistent colors to match original R style
    condition_colors = {
        'Case': '#d73027',
        'Control': '#4575b4'
    }

    # Prepare EV plot range
    ev_start = plot_df['window_start'].min()
    ev_end = plot_df['window_end'].max()

    # Plot setup
    fig, (ax1, ax2) = plt.subplots(
        nrows=2,
        figsize=(16, 10),
        gridspec_kw={'height_ratios': [1, 4]}
    )

    # --- EV Layout (top) ---
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

        all_starts = ev_df["start"].tolist()
        all_ends = ev_df["end"].tolist()

        for x in all_starts + all_ends:
            ax1.plot([x, x], [0, 0.1], color="black", linewidth=0.2)

        ax1.hlines([0, 0.1], ev_start, ev_end, colors="black", linewidth=0.5)
        ax1.text(ev_start - 5, 0.05, "5'", ha='right', va='center', fontsize=8)
        ax1.text(ev_end + 5, 0.05, "3'", ha='left', va='center', fontsize=8)
        ax1.set_xlim(ev_start - 10, ev_end + 10)
        ax1.set_ylim(-0.05, 0.15)
        ax1.axis("off")
    else:
        ax1.axis("off")

    # --- Antigen Map barplot (bottom) ---
    sns.barplot(
        data=plot_df,
        x='x_mid',
        y='moving_sum',
        hue='Condition',
        palette=condition_colors,
        dodge=False,
        ax=ax2
    )

    ax2.set_title("Antigen Map: Moving Sum of RPK Differences", fontsize=16)
    ax2.set_xlabel("Position in sequence (amino acids)", fontsize=14)
    ax2.set_ylabel("Moving Sum", fontsize=14)
    ax2.legend(title='', loc='upper right')
    ax2.grid(False)

    plt.tight_layout()

    # Save or return as file
    if output_path:
        plt.savefig(output_path)
        plt.close()
        return send_file(output_path, mimetype='image/png', as_attachment=False, download_name='antigen_map_cleaned.png')

    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=300)
    plt.close()
    buf.seek(0)
    return send_file(buf, mimetype="image/png")

# Time for the EV Plot
def read_ev_polyprotein_uniprot_metadata(tsv_path):
    # Load data
    df = pd.read_csv(tsv_path, sep="\t")

    # Remove overlapping proteins
    overlapping_ev_proteins = [
        "P1", "Genome polyprotein", "Capsid protein VP0", "P2", "P3",
        "Protein 3A", "Viral protein genome-linked", "Protein 3CD"
    ]

    ev_proteins_list = ["VP4", "VP2", "VP3", "VP1", "2A", "2B", "2C", "3AB", "3C", "3D"]

    # Split 'Chain' column into multiple rows using regex
    df = df.drop(columns=["Entry", "Reviewed"], errors="ignore")

    # Expand 'Chain' field into multiple rows if needed
    df = df.assign(Chain=df["Chain"].str.split("; CHAIN")).explode("Chain")

    # Extract values from the 'Chain' field
    df["start"] = df["Chain"].str.extract(r'(\d+)').astype(float)
    df["end"] = df["Chain"].str.extract(r'\.\.(\d+)').astype(float)
    df["note"] = df["Chain"].str.extract(r'/note="([^"]+)"')
    df["id"] = df["Chain"].str.extract(r'/id="([^"]+)"')

    # Remove overlapping proteins
    df = df[~df["note"].isin(overlapping_ev_proteins)]

    # Extract protein names from notes
    pattern = "|".join(ev_proteins_list)
    df["ev_proteins"] = df["note"].str.extract(f"({pattern})")
    df["ev_proteins"] = df["ev_proteins"].fillna("3D")

    # Adjust start if needed
    df["start"] = df["start"].replace(2, 1)

    # Subset protein sequence from full Sequence
    df["protein_aa"] = df.apply(lambda row: row["Sequence"][int(row["start"]) - 1:int(row["end"])], axis=1)

    return df

# Once again translated Legana's code.
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

    # Draw ticks and horizontal bounds
    for x in all_starts + all_ends:
        ax.plot([x, x], [0, 0.1], color="black", linewidth=0.2)
    ax.hlines(0, min(all_starts), max(all_ends), colors="black", linewidth=0.5)
    ax.hlines(0.1, min(all_starts), max(all_ends), colors="black", linewidth=0.5)

    # Add 5' and 3' labels
    ax.text(min(all_starts) - 5, 0.05, "5'", ha='right', va='center', fontsize=8)
    ax.text(max(all_ends) + 5, 0.05, "3'", ha='left', va='center', fontsize=8)

    # Clean up axis
    ax.set_xlim(min(all_starts) - 10, max(all_ends) + 10)
    ax.set_ylim(-0.05, 0.15)
    ax.axis("off")
    return ax
