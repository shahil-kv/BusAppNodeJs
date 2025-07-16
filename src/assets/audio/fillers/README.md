# Filler Audio Files

This directory should contain the pre-recorded audio files for backchanneling (conversational fillers).

## Requirements:

1.  **Format:** The audio files MUST be in `.raw` format.
2.  **Codec:** The audio MUST be encoded using **8-bit μ-law**.
3.  **Sample Rate:** The audio MUST have a sample rate of **8000 Hz**.
4.  **Channels:** The audio MUST be **mono** (single channel).

## Example Files:

*   `uh-huh.raw`
*   `okay.raw`
*   `mhm.raw`
*   `i-see.raw`

You can use a tool like Audacity or `sox` to create and convert these files into the correct format.

**Example using `sox`:**
`sox input.wav -r 8000 -c 1 -e u-law output.raw`
