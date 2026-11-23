# AUREA Puls tima — APPROVED MANAGER MASTER (LOCKED)

Approved by product owner on 2026-11-23 after reviewing the restored complete manager experience at `/rukovodilac/`.

**Canonical live preview route:** `/rukovodilac/`

**Byte-for-byte archived source:** `locked/manager-v35-approved.html`

**Original source Git blob SHA:** `95a9bedd21cb20371e428e91d0292b29681f4500`

**Archive commit:** `dffb6b5a77fa7918ab4ef4fe49e32e79ca617fde`

## Locked decisions
- Retain full previously approved experience and rich guided manager interaction, not simplified percentage cards.
- Preserve AUREA ivory/burgundy/gold premium style, content, navigation, activities, step-back, final screen, and mobile experience.
- Never overwrite the manager experience with a shortened V4 demo.
- All future enhancements should be additive and tested in isolation before merging.
- Preserve employee experience, Kringle, and public AUREA website.
- Existing V4 demo route redirects to canonical manager preview.
- Archive is a recovery snapshot, **not** an enforcement mechanism preventing future repository writes. Changes to the live manager source still require regression review and explicit approval.

## Restoration
If future manager work regresses the approved experience, restore `rukovodilac/index.html` from `locked/manager-v35-approved.html` and verify the preview before proceeding.
