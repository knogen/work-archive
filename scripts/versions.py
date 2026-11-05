"""Conservative filename normalization for revision grouping.

Preserve numeric sample sizes, dataset identifiers and distinct numbered figures.
Only strip copy suffixes and explicit revision/date suffixes.
"""
import pathlib,re

def family_key(name):
    p=pathlib.Path(name)
    stem=p.stem.strip().replace('Wikipeida','Wikipedia')
    stem=re.sub(r'(?:\s*[（(]\d+[)）])+\s*$','',stem)
    stem=re.sub(r'[-_\s]*v\d+$','',stem,flags=re.I)
    stem=re.sub(r'[-_\s]+v?20\d{6}(?=[_\-\s]|$)','',stem,flags=re.I)
    stem=re.sub(r'[-_\s]+20\d{2}-\d{1,2}-\d{1,2}(?=[_\-\s]|$)','',stem)
    stem=re.sub(r'[-_\s]+20\d{4}$','',stem)
    stem=re.sub(r'[-_\s]*v\d+$','',stem,flags=re.I)
    # Explicitly reviewed historical short revision suffix.
    if stem.startswith('OneCulture-TwoCultures-ManyCultures'):
        stem=re.sub(r'4-16$','',stem)
    # These workbook suffixes denote numbered revisions, not sample sizes.
    if stem.startswith('拟合公式'):
        stem=re.sub(r'_\d+$','',stem)
    return re.sub(r'[\s_\-]+','',stem).casefold()+p.suffix.casefold()
