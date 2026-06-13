---
schema_version: 1
agent_version: 1
address: "{{ address }}"
coordinates: [{{ lat }}, {{ lng }}]
stories_visible: {{ stories_visible }}
iso_class: "{{ iso_class }}"
confidence: {{ confidence }}
selected_view:
  id: {{ selected_view_id }}
  heading: {{ selected_heading }}
  pitch: {{ selected_pitch }}
imagery: {{ imagery_json }}
---

# Property Visual Inspection

## Executive summary

{{ summary }}

## Subject building

{{ subject_section }}

## Floor analysis

{{ floor_table }}

## Construction observations

{{ construction_section }}

## Limitations

{{ limitations_section }}

## Agent trace

{{ trace_section }}
