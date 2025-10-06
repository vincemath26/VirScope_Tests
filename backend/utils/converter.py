import pandas as pd
from io import BytesIO
from utils import r2
from utils.viruses.enterovirus import calculate_mean_rpk_difference

def convert_user_upload_to_long(r2_filename: str, overwrite: bool = True) -> str:
    """
    Converts a user-uploaded VirScan file to long format and adds Condition based on mean RPK differences.
    """
    # 1. Fetch file from R2
    file_bytes = r2.fetch_upload_from_r2(r2_filename)

    # 2. Detect delimiter
    sample = file_bytes[:1024].decode('utf-8', errors='ignore')
    delimiter = ','
    try:
        import csv
        delimiter = csv.Sniffer().sniff(sample).delimiter
    except Exception:
        pass

    # 3. Read into pandas
    df = pd.read_csv(BytesIO(file_bytes), sep=delimiter, low_memory=False)

    # 4. Remove Beads_Only columns
    df = df.loc[:, ~df.columns.str.contains("Beads_Only")]

    # 5. Rename start/end columns
    df.rename(columns={"pos_start": "sstart", "pos_end": "send"}, inplace=True)

    # 6. Define columns after renaming
    meta_cols = ["pep_id", "pep_aa", "sstart", "send", "taxon_species"]

    # 7. Identify sample columns
    sample_cols = [col for col in df.columns if col not in meta_cols]

    # 7a. Ensure sample columns are numeric
    for col in sample_cols:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

    # 8. Filter out peptides that are zero in all samples
    df = df[df[sample_cols].sum(axis=1) > 0]

    # Remove specific positive controls, e.g., "POS_CTRL"
    if "POS_CTRL" in sample_cols:
        df.drop(columns=["POS_CTRL"], inplace=True)
        sample_cols.remove("POS_CTRL")

    # 9. Melt to long format
    df_long = df.melt(
        id_vars=meta_cols,
        value_vars=sample_cols,
        var_name="sample_id",
        value_name="abundance"
    )

    # 10. Calculate RPK and mean RPK difference for Condition
    df_long['rpk'] = df_long.groupby('sample_id')['abundance'].transform(lambda x: x / x.sum() * 1e5)
    
    # Use refactored calculate_mean_rpk_difference
    mean_diff_df = calculate_mean_rpk_difference(df_long)
    mean_diff_map = mean_diff_df.set_index('pep_id')['mean_rpk_difference'].to_dict()
    
    # Assign Condition based on sign of mean_rpk_difference
    df_long['Condition'] = df_long['pep_id'].map(lambda x: 'Case' if mean_diff_map.get(x, 0) > 0 else 'Control')

    # 11. Final column order
    final_cols = [
        "pep_id", "pep_aa", "sstart", "send", "taxon_species",
        "sample_id", "abundance", "Condition"
    ]
    df_long = df_long[final_cols]

    # 12. Save to BytesIO and upload back to R2
    csv_bytes = BytesIO()
    df_long.to_csv(csv_bytes, index=False)
    csv_bytes.seek(0)

    if overwrite:
        r2.upload_file_to_r2(r2.r2_client, r2.R2_BUCKET_NAME, csv_bytes, r2_filename)
        return r2_filename
    else:
        new_filename = r2_filename.replace(".csv", "_long.csv")
        r2.upload_file_to_r2(r2.r2_client, r2.R2_BUCKET_NAME, csv_bytes, new_filename)
        return new_filename
