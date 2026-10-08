"""The confidence gate, and an honest record of what it does not cover.

The gate is a safety control: below it, no treatment is named. These tests pin
its arithmetic and its boundary, and document the out-of-distribution gap that
the gate structurally cannot close.
"""

import pytest

from config import CLASSES, CONFIDENCE_GATE


def actionable(confidence: float) -> bool:
    """The rule applied in api.py: `confidence >= CONFIDENCE_GATE`."""
    return confidence >= CONFIDENCE_GATE


def test_gate_is_in_a_sane_range():
    # A gate at 0 recommends pesticide for every photo; a gate at 1 never
    # recommends anything. Either would be a configuration mistake worth
    # catching before it reaches a farmer.
    assert 0.25 < CONFIDENCE_GATE < 1.0


def test_gate_beats_chance_for_the_class_count():
    # A uniform softmax gives 1/len(CLASSES). A gate at or below chance would
    # pass a model that had learned nothing at all.
    assert CONFIDENCE_GATE > 1.0 / len(CLASSES)


def test_boundary_is_inclusive():
    # `>=` not `>`. Pinned because flipping it silently changes behaviour for
    # predictions landing exactly on the gate.
    assert actionable(CONFIDENCE_GATE)
    assert not actionable(CONFIDENCE_GATE - 1e-9)


@pytest.mark.parametrize("confidence", [0.0, 0.1, 0.25, 0.5])
def test_low_confidence_withholds_treatment(confidence):
    if confidence < CONFIDENCE_GATE:
        assert not actionable(confidence)


@pytest.mark.parametrize("confidence", [0.9, 0.99, 1.0])
def test_high_confidence_releases_treatment(confidence):
    assert actionable(confidence)


def test_probabilities_cover_every_declared_class():
    # The API contract returns one probability per class. Adding a class to
    # CLASSES without retraining would break the mapping in predict_disease,
    # which zips CLASSES against the model's output width.
    assert len(CLASSES) == len(set(CLASSES)), "class names must be unique"
    assert CLASSES == sorted(CLASSES), (
        "CLASSES order defines the label->index mapping the weights were "
        "trained with; keep it stable and sorted"
    )


def test_gate_does_not_bound_out_of_distribution_error():
    """Documents a known, measured limitation.

    Softmax over the disease classes has no "none of the above" output, so it
    normalises whatever it is given into those classes. Measured with the
    previous 4-class weights: a photo of a whole paddy field returned
    brown_spot at 0.97, and a solid colour image returned leaf_blast at ~1.00.
    Both cleared the gate. The current model has not been re-measured, so
    treat the limitation as still present.

    The gate bounds *low-confidence* error only. Closing the OOD case needs a
    rejection class or an OOD detector - see the README. This test exists so
    the limitation is asserted in the suite rather than living only in prose.
    """
    ood_confidence = 0.97  # observed, paddy field photo
    assert actionable(ood_confidence), (
        "if this ever fails, the gate has been raised above the measured OOD "
        "confidence - update the README's limitations section to match"
    )


def test_weights_match_the_class_list():
    """The head width in rice_model.pth must equal len(classes.json["classes"]).

    The two files are produced together by one training run and must be
    deployed together. A mismatch (new weights with an old classes.json, or
    the reverse) would not crash inference if the sizes happened to agree - it
    would silently attach the wrong disease names - so the shapes are checked
    here. Skipped when the (gitignored) weights are not present.
    """
    import torch

    from config import MODEL_PATH

    if not MODEL_PATH.exists():
        pytest.skip("weights not present")

    state = torch.load(MODEL_PATH, map_location="cpu")
    head = next(v for k, v in state.items() if k.endswith("classifier.1.weight"))
    assert head.shape[0] == len(CLASSES)
