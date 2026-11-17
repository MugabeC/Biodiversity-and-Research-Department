#!/usr/bin/env python3
"""
Turn the department's dashboard workbook (Dashboard_Data_Entry*.xlsx) into the JSON files the dashboard reads.

    python3 scripts/import_dashboard_xlsx.py path/to/workbook.xlsx            # write public/data/*.json
    python3 scripts/import_dashboard_xlsx.py path/to/workbook.xlsx --dry-run  # only check and report

Needs openpyxl (pip install openpyxl). Columns are found by their header names, so column order does not matter.
The script re-computes every figure in the workbook's own Monthly_Summary sheet from the raw rows and
reports any difference, so a mistake in either place is caught before anything is published.
Applicant names in Internships are never copied: only monthly counts are published.
"""
import argparse, datetime as dt, json, sys
from collections import OrderedDict, defaultdict
from pathlib import Path
from openpyxl import load_workbook

MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
DATA_DIR = Path(__file__).resolve().parent.parent / 'public' / 'data'


# ── helpers ────────────────────────────────────────────────────────────────
def as_date(v):
    if isinstance(v, dt.datetime): return v.date()
    if isinstance(v, dt.date): return v
    return None

def month_key(v):
    d = as_date(v)
    return (d.year, d.month) if d else None

def month_label(key):
    return f'{MONTH_NAMES[key[1] - 1]} {key[0]}'

def iso(v):
    d = as_date(v)
    return d.isoformat() if d else None

def num(v):
    if v is None or v == '': return None
    if isinstance(v, (int, float)): return int(v) if float(v).is_integer() else float(v)
    try:
        f = float(str(v).replace(',', '').strip())
        return int(f) if f.is_integer() else f
    except ValueError:
        return None

def text(v):
    if v is None: return None
    s = str(v).strip()
    return s or None

def rows_of(ws):
    """Rows as dicts keyed by header; fully empty rows are skipped."""
    it = ws.iter_rows(values_only=True)
    headers = [text(h) for h in next(it)]
    out = []
    for r in it:
        if all(c is None or (isinstance(c, str) and not c.strip()) for c in r): continue
        out.append({h: v for h, v in zip(headers, r) if h})
    return out

def need(rows, sheet, cols):
    got = set(rows[0].keys()) if rows else set()
    missing = [c for c in cols if c not in got]
    if missing: sys.exit(f'ERROR: sheet "{sheet}" is missing column(s): {", ".join(missing)}')


# ── per-sheet conversion ───────────────────────────────────────────────────
def build(wb):
    out, agg, notes = {}, defaultdict(lambda: defaultdict(float)), []

    # Settings + Species -> summary.json
    st = {r['Setting']: r for r in rows_of(wb['Settings'])}
    size = st['Park size']
    size_txt = f"{size['Value']:g} {str(size.get('Unit') or 'ha').capitalize()}" if isinstance(size['Value'], (int, float)) else str(size['Value'])
    taxa_rows = rows_of(wb['Species'])
    need(taxa_rows, 'Species', ['Taxa', '2023 count', '2025 count'])
    key_of = {'Birds': 'birds', 'Plants': 'plants', 'Amphibians & Reptiles': 'amphibians_reptiles', 'Fish': 'fish',
              'Aquatic invertebrates': 'aquatic_inverts', 'Butterflies': 'butterflies', 'Mammals': 'mammals'}
    taxa = OrderedDict()
    for r in taxa_rows:
        k = key_of.get(text(r['Taxa']))
        if not k: notes.append(f'Species: unknown group "{r["Taxa"]}" skipped'); continue
        t = OrderedDict(count2025=num(r['2025 count']), count2023=num(r['2023 count']))
        for src, dst in (('Orders', 'orders'), ('Families', 'families'), ('Amphibians', 'amphibians'), ('Reptiles', 'reptiles')):
            if num(r.get(src)) is not None: t[dst] = num(r[src])
        taxa[k] = t
    out['summary.json'] = OrderedDict(parkName=st['Park name']['Value'], parkSize=size_txt, location=st['Location']['Value'],
                                      surveyYear=str(st['Survey year (label)']['Value']),
                                      studentTargetPerQuarter=num(st['Student target per quarter']['Value']),
                                      totalSpecies=sum(t['count2025'] or 0 for t in taxa.values()), taxa=taxa)

    # School visits
    sv = rows_of(wb['School_Visits']); need(sv, 'School_Visits', ['Month', 'School / group', 'Students'])
    months = OrderedDict()
    for r in sv:
        k = month_key(r['Month']); m = months.setdefault(k, OrderedDict(month=month_label(k), subtotal_students=None, school_groups=None, visits=[]))
        stu, grp = num(r['Students']), num(r.get('School groups'))
        if stu is not None: m['subtotal_students'] = (m['subtotal_students'] or 0) + stu
        if grp is not None: m['school_groups'] = (m['school_groups'] or 0) + grp
        for col, a in (('Students', 'students'), ('Teachers recorded', 'teachers'), ('School groups', 'groups'), ('Complimentary participants', 'school_comp')):
            if num(r.get(col)) is not None: agg[k][a] += num(r[col])
        m['visits'].append(OrderedDict(school=text(r['School / group']), students=stu, school_groups=grp, teachers=num(r.get('Teachers recorded')),
                                       other_adults=num(r.get('Other adults recorded')), complimentary=num(r.get('Complimentary participants')),
                                       programme=text(r.get('Programme')), programme_pupils=num(r.get('Programme pupils'))))
    out['NEP_school_visits.json'] = OrderedDict(dataset='NEP School Visits', source_sheet='School_Visits', months=[months[k] for k in sorted(months)])

    # Community activities
    ca = rows_of(wb['Community_Activities']); need(ca, 'Community_Activities', ['Month', 'Activity'])
    months = OrderedDict()
    for r in ca:
        k = month_key(r['Month']); m = months.setdefault(k, OrderedDict(month=month_label(k), activities=[]))
        m['activities'].append(OrderedDict(activity=text(r['Activity']), participant_group=text(r.get('Participant group')),
                                           participants=num(r.get('Participants recorded')), women=num(r.get('Women')), men=num(r.get('Men')),
                                           institutions=num(r.get('Institutions')), complimentary=num(r.get('Complimentary participants'))))
        agg[k]['activities'] += 1
        for col, a in (('Participants recorded', 'participants'), ('Complimentary participants', 'community_comp')):
            if num(r.get(col)) is not None: agg[k][a] += num(r[col])
    out['NEP_community_engagement.json'] = OrderedDict(dataset='NEP Community Engagement', source_sheet='Community_Activities', months=[months[k] for k in sorted(months)])

    # Complimentary admissions = passes + school complimentary + community complimentary (same rule as Monthly_Summary)
    cp = rows_of(wb['Complementary_Passes']); need(cp, 'Complementary_Passes', ['Month', 'Passes'])
    detail, all_scope = defaultdict(list), set()
    for r in cp:
        n = num(r['Passes'])
        if n is None: continue
        k = month_key(r['Month'])
        if 'all complimentary' in (text(r.get('Admission scope')) or '').lower(): all_scope.add(k)  # this row is already the month's total
        detail[k].append(OrderedDict(group=text(r.get('Group / category')) or text(r.get('Admission scope')) or 'Complimentary admissions', count=n, notes=text(r.get('Admission scope'))))
        agg[k]['passes'] += n
    keys = sorted(set(detail) | {k for k in agg if k != '_admissions' and (agg[k].get('school_comp') or agg[k].get('community_comp'))})
    admissions_total = {}
    months = []
    for k in keys:
        items = list(detail.get(k, []))
        if k in all_scope:
            months.append(OrderedDict(month=month_label(k), subtotal=sum(i['count'] for i in items), passes=items)); continue
        if agg[k].get('school_comp'): items.append(OrderedDict(group='Complimentary participants in school visits', count=int(agg[k]['school_comp']), notes='From School_Visits'))
        if agg[k].get('community_comp'): items.append(OrderedDict(group='Complimentary participants in community activities', count=int(agg[k]['community_comp']), notes='From Community_Activities'))
        months.append(OrderedDict(month=month_label(k), subtotal=sum(i['count'] for i in items), passes=items))
    for m in months:
        admissions_total[m['month']] = m['subtotal']
    agg['_admissions'] = admissions_total
    out['NEP_complementary_passes.json'] = OrderedDict(dataset='NEP Complimentary Admissions', source_sheet='Complementary_Passes + School_Visits + Community_Activities', months=months)

    # Research requests
    rr = rows_of(wb['Research_Requests']); need(rr, 'Research_Requests', ['Month', 'Applicant / group', 'Category', 'Status'])
    data = []
    for r in rr:
        k = month_key(r['Month']); agg[k]['research'] += 1
        data.append(OrderedDict([('month', month_label(k)), ('Date Received', iso(r.get('Request date'))), ('Names', text(r['Applicant / group'])),
                                 ('Category', text(r['Category'])), ('Institution', text(r.get('Institution'))), ('Program/Degree level', text(r.get('Programme / degree'))),
                                 ('Research Title / Topic', text(r.get('Research topic'))), ('Requested Activities', text(r.get('Requested activity'))), ('Status', text(r.get('Status')))]))
    out['Research_ALL.json'] = OrderedDict(source='Nyandungu Eco-Park Research Database', description='All research requests', total_records=len(data), data=data)

    # Internships: counts only (no applicant names are published)
    it = rows_of(wb['Internships']); need(it, 'Internships', ['Application month', 'Type', 'Start month', 'Application records', 'Starts recorded'])
    starts = {'Academic': defaultdict(int), 'Professional': defaultdict(int)}; apps = defaultdict(int)
    for r in it:
        ak, sk = month_key(r['Application month']), month_key(r['Start month'])
        if ak and num(r.get('Application records')): apps[ak] += num(r['Application records']); agg[ak]['applications'] += num(r['Application records'])
        typ = text(r.get('Type'))
        if sk and typ in starts and num(r.get('Starts recorded')):
            starts[typ][sk] += num(r['Starts recorded']); agg[sk][typ.lower() + '_starts'] += num(r['Starts recorded'])
    allk = sorted(set(starts['Academic']) | set(starts['Professional']))
    span = []
    if allk:
        y, m = allk[0]
        while (y, m) <= allk[-1]:
            span.append((y, m)); m += 1
            if m == 13: y, m = y + 1, 1
    out['NEP_internship.json'] = OrderedDict(dataset='NEP Internships (placements = start month)', source_sheet='Internships',
        academic_internship=[OrderedDict(month=month_label(k), count=starts['Academic'].get(k, 0)) for k in span],
        professional_internship=[OrderedDict(month=month_label(k), count=starts['Professional'].get(k, 0)) for k in span if starts['Professional'].get(k)],
        applications=[OrderedDict(month=month_label(k), count=apps[k]) for k in sorted(apps)])

    # Conflict cases (no phone numbers or reporter names are used)
    cf = rows_of(wb['Conflict_Cases']); need(cf, 'Conflict_Cases', ['Case ID', 'Month', 'Date reported', 'Status'])
    data = []
    for r in sorted(cf, key=lambda x: num(x['Case ID']) or 0):
        k = month_key(r['Month']); agg[k]['conflicts'] += 1
        if text(r.get('Status')) == 'Open': agg[k]['open_conflicts'] += 1
        data.append(OrderedDict(id=num(r['Case ID']), month=month_label(k), date=iso(r.get('Date reported')), stakeholder=text(r.get('Stakeholder type')),
                                areaType=text(r.get('Area type')), location=text(r.get('Location')), category=text(r.get('Category')), issueType=text(r.get('Issue type')),
                                description=text(r.get('Description')), affectedArea=text(r.get('Affected area')), actionType=text(r.get('Action type')),
                                assignedTo=text(r.get('Assigned to')), status=text(r.get('Status')), resolutionDate=iso(r.get('Resolution date')),
                                actionTaken=text(r.get('Action taken')), followUpRequired=text(r.get('Follow-up required'))))
    out['Conflict_Management.json'] = OrderedDict(source='Nyandungu Eco-Park Community Data', sheet='Conflict_Cases', total_records=len(data), data=data)

    # Waste
    ws_ = rows_of(wb['Waste']); need(ws_, 'Waste', ['Reporting month', 'Waste collected (kg)'])
    recs = []
    for r in ws_:
        k = month_key(r['Reporting month']); kg = num(r['Waste collected (kg)'])
        if kg is None: notes.append(f'Waste: {month_label(k)} has no total, so it is left out (dashboard shows "no data")'); continue
        agg[k]['waste'] += kg
        recs.append(OrderedDict(month=month_label(k), waste_collected_kg=kg, biodegradable_kg=num(r.get('Biodegradable (kg)')), non_biodegradable_kg=num(r.get('Non-biodegradable (kg)'))))
    out['NEP_waste_management.json'] = OrderedDict(dataset='NEP Waste Management', source_sheet='Waste', records=recs)
    return out, agg, notes


# ── water: compare with what the site already has ──────────────────────────
def water_check(wb):
    """Rebuild the water readings from the long-format sheets and compare with public/data/water_quality.json."""
    cur = json.load(open(DATA_DIR / 'water_quality.json', encoding='utf-8'))
    report = []
    # WASAC
    wz = rows_of(wb['Water_WASAC']); need(wz, 'Water_WASAC', ['Sampling point / report', 'Parameter', 'Limit', 'Result', 'Within limit'])
    pts = [p.split(' ')[0] for p in cur['wasac']['samplingPoints']]
    diffs, yes, no = [], 0, 0
    old = {p['parameter']: p for p in cur['wasac']['parameters']}
    for r in wz:
        key = text(r['Sampling point / report']).split(' ')[0]; p = old.get(text(r['Parameter']))
        if p is None: diffs.append(f'new parameter {r["Parameter"]}'); continue
        a_, b_ = num(p.get(key)), num(r['Result'])
        same_ = (a_ == b_) if (a_ is not None and b_ is not None) else str(p.get(key)).strip() == str(r['Result']).strip()
        if not same_: diffs.append(f'{r["Parameter"]}/{key}: {p.get(key)} -> {r["Result"]}')
        if str(p.get('limit')) != str(text(r['Limit'])): diffs.append(f'{r["Parameter"]} limit {p.get("limit")} -> {r["Limit"]}')
        wl = text(r['Within limit']); yes += wl == 'Yes'; no += wl == 'No'
    rate = round(yes / (yes + no) * 100, 1) if yes + no else None
    if rate != cur['wasac']['overall']['rate']: diffs.append(f'overall rate {cur["wasac"]["overall"]["rate"]} -> {rate}')
    per = defaultdict(lambda: [0, 0])
    for r in wz:
        wl = text(r['Within limit'])
        if wl in ('Yes', 'No'): per[text(r['Parameter'])][0 if wl == 'Yes' else 1] += 1
    for name, p in old.items():
        if p.get('compliant') in ('–', None): continue
        if per[name] != [int(p['compliant']), int(p['exceeded'])]: diffs.append(f'{name}: compliant/exceeded {p["compliant"]}/{p["exceeded"]} -> {per[name][0]}/{per[name][1]}')
    report.append(('WASAC', len(wz), diffs))
    # Park survey
    pz = rows_of(wb['Water_Park_Survey']); need(pz, 'Water_Park_Survey', ['Sampling point', 'Parameter', 'Result'])
    oldp = {p['parameter']: p for p in cur['biodiversitySurvey']['parameters']}
    diffs = []
    for r in pz:
        p = oldp.get(text(r['Parameter']))
        if p is None: diffs.append(f'new parameter {r["Parameter"]}'); continue
        ov = p['points'].get(text(r['Sampling point'])); nv = r['Result']
        same = (ov in (None, '') and nv in (None, '')) or str(ov).strip() == str(nv).strip() or (num(ov) is not None and num(ov) == num(nv))
        if not same: diffs.append(f'{r["Parameter"]}/{r["Sampling point"]}: {ov} -> {nv}')
    report.append(('Park survey', len(pz), diffs))
    return report


# ── oracle: the workbook's own Monthly_Summary ─────────────────────────────
def oracle(wb, agg):
    ws = wb['Monthly_Summary']; it = ws.iter_rows(values_only=True); hdr = [text(h) for h in next(it)]
    cols = {'Students recorded': 'students', 'Teachers recorded': 'teachers', 'School groups': 'groups', 'Community activities': 'activities',
            'Community participants': 'participants', 'Research requests': 'research', 'Internship applications': 'applications',
            'Academic starts': 'academic_starts', 'Professional starts': 'professional_starts', 'Waste collected (kg)': 'waste',
            'Conflicts reported': 'conflicts', 'Open conflicts': 'open_conflicts'}
    bad, checked = [], 0
    for r in it:
        k = month_key(r[0])
        if not k or k == '_admissions': continue
        row = dict(zip(hdr, r))
        want_comp = num(row.get('Complimentary admissions')) or 0
        got_comp = agg['_admissions'].get(month_label(k), 0)
        if want_comp != got_comp: bad.append((month_label(k), 'Complimentary admissions', want_comp, got_comp))
        for h, a in cols.items():
            want = num(row.get(h)) or 0; got = agg[k].get(a, 0)
            checked += 1
            if want != got: bad.append((month_label(k), h, want, got))
    return checked, bad


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('xlsx'); ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()
    wb = load_workbook(a.xlsx, data_only=True)
    out, agg, notes = build(wb)
    checked, bad = oracle(wb, agg)
    print(f'Monthly_Summary cross-check: {checked} figures compared, {len(bad)} differences')
    for b in bad: print('   DIFFERENCE', b)
    for title, n, diffs in water_check(wb):
        print(f'Water ({title}): {n} readings in the workbook; differences from the site: {len(diffs)}')
        for d in diffs[:12]: print('   ', d)
    for n in notes: print('NOTE', n)
    if a.dry_run:
        print('dry run: no files written'); return 1 if bad else 0
    for name, obj in out.items():
        (DATA_DIR / name).write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('written:', ', '.join(out))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
