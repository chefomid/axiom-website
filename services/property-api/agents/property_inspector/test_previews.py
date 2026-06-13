"""Tests for imagery capture serialization."""

from agents.property_inspector.tools.streetview import InspectorImage, serialize_imagery_captures


def _img(image_id: str, heading: int | None = None) -> InspectorImage:
    return InspectorImage(
        image_id=image_id,
        label=f"Label {image_id}",
        content_type="image/jpeg",
        data=b"\xff\xd8\xff" + b"x" * 600,
        heading=heading,
    )


def test_serialize_imagery_captures_orders_selected_first():
    satellite = _img("satellite")
    street_a = _img("street_a", heading=90)
    street_b = _img("street_b", heading=180)
    images = {
        "satellite": satellite,
        "street_a": street_a,
        "street_b": street_b,
    }
    previews = serialize_imagery_captures(
        images,
        street_images=[street_a, street_b],
        selected_image_id="street_b",
    )
    assert len(previews) == 3
    assert previews[0]["image_id"] == "street_b"
    assert previews[0]["selected"] is True
    assert previews[0]["data_url"].startswith("data:image/jpeg;base64,")
    assert previews[1]["image_id"] == "street_a"
    assert previews[2]["image_id"] == "satellite"
