# Media pipeline improvements — 2026-11-17

Source: operator session request (chat content links, unique filenames, reconciliation,
audio-confirmation gate, per-user library, multi-image composition, local ComfyUI Privacy path).

## Work items

- [x] M1 Unique output filenames per job — no overwrite collisions
  - `skill/satchida-montage-server.py`: `_unique_media_name()` + collision guard in `_publish_artifact`
  - `skill/anythingllm_mcp_server.py`: document output filename collision guard
  - `skill/satchida-scenemosaic-server.py`: checked — emits HTML inline only, writes no files
- [x] M2 Ledger reconciliation report automation (billed-vs-delivered per render)
  - script: query Bifrost logs.db + one-api + exports/generated → CSV + MD
  - produce fresh 2026-11-17 report
- [x] M3 In-chat links + thumbnails + downloads; per-user library
  - video thumbnail at publish time; manifest entries carry `thumb`
  - studio-library.html: poster thumbnails, selection for compose
  - per-user attribution in manifest; library page user filter
  - `/api/studio/library` auth'd route live in `api/server/index.js`
- [x] M4 Audio-confirmation gate audit for animated/video generation (all tools)
  - `video_generate` requires `audio_mode`; `media_compose` requires explicit audio choice;
    `animated_generate_local` requires `silent`|`ambient_sfx`
- [x] M5 Multi-image composition tools (collage / slideshow video with music) on selected library files
  - `library_list` + `media_compose` in `skill/satchida-montage-server.py`
- [x] M6 Local image models via ComfyUI (:8188) for Privacy tier / Privacy mode
  - ComfyUI headless running (pid in `Satchida-Studio/tmp/comfyui.pid`); GGUF/VHS/MMAudio nodes installed
  - `comfy_status`, `image_generate_local`, `animated_generate_local` added; SD1.5 E2E verified
  - Privacy routing guidance wired into OpenFilm/Motion/3D-Studio personas in `librechat.yaml`
- [x] M7 Past chats: link-repair scan in Mongo; deletion candidates (confirm with operator before delete)
  - `satchida/ops/fix_chat_links.py` run with `--fix`: 24 links, 21 OK, 3 REPAIRED, 0 BROKEN
  - 1 deletion candidate deleted with operator confirmation (`125fc105-8f96-51d5-a147-66c52fb75668`: 1 conversation + 2 messages)
