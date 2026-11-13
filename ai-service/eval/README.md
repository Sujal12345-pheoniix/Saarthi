# CV evaluation framework

Measures how the skin and posture engines behave on **labelled, licensed** images. No dataset ships with this
repository and none may be scraped: face and body photos are biometric, health-adjacent data. See
`docs/ai/EVALUATION.md` for the dataset, consent and licensing requirements.

## Files

| File | Purpose |
|---|---|
| `manifest.schema.json` | Schema for one manifest line (image, expected labels, cohort tags, required provenance). |
| `run_eval.py` | Runs the engines over a manifest and writes a JSON + Markdown report. |
| `metrics.py` | Pure metric functions (precision/recall, MAE/RMSE, confusion matrix, cohort grouping, calibration). |
| `synthetic.py` | Robustness perturbations (blur, exposure, noise, JPEG, rotation, occlusion, downscale) and synthetic non-face / non-person images. |

## Run

Inside the service image (or any Python 3.10 environment with `requirements.txt` installed), from `ai-service/`:

```bash
python -m eval.run_eval --manifest /data/saarthi-eval/manifest.jsonl --out reports/eval-2026-11-13
```

Manifest entries missing `provenance.dataset`, `source`, `license`, `consent`, `labelledBy` or `labelProtocol`
are refused.

## What the report contains

- Rejection precision / recall / false-positive rate against `expected.shouldReject`
- For each measurement with a reference value: n, MAE, RMSE, bias, median and 90th-percentile absolute error and
  an error histogram
- Posture view-classification accuracy and confusion matrix
- Engine error rate (crashes) separately from deliberate rejections
- All of the above per cohort (Fitzpatrick / Monk skin tone, lighting, camera, age band, body type, pose, occlusion)
- Calibration: reported as *not applicable*, because neither engine emits a probability for its decisions

The metric functions and the synthetic-negative rejection path are covered by `tests/test_eval_*.py`.
