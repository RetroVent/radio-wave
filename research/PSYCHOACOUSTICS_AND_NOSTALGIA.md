# Psychoacoustics, Timbral Perception, and Autobiographical Memory

## 1. Epistemic Framework

This document synthesizes peer-reviewed auditory perception, psychoacoustics, and cognitive neuroscience literature to guide our DSP architecture. We strictly separate:

- **Verified Empirical Findings:** Peer-reviewed results verified via PubMed and OpenAlex (with exact DOIs/PMIDs).
- **Plausible Design Hypotheses:** Testable predictions linking electroacoustic cues to listener impressions of warmth, intimacy, or era.
- **Explicit Scientific Boundaries:** What audio DSP _cannot_ guarantee (e.g., universal nostalgia or specific neurochemical release).

---

## 2. Psychoacoustics of Vintage Radio Coloration

### 2.1 Frequency Sensitivity, Equal-Loudness Contours, and Bandwidth Limitation

- **Research Question:** How does restricting low and high frequencies alter perceived naturalness, speech intelligibility, and tonal balance?
- **Source & Date:** Moore, B. C. J., & Tan, C.-T. (2003). _Perceived naturalness of spectrally distorted speech and music_. _The Journal of the Acoustical Society of America_, 114(1), 408–419. DOI: `10.1121/1.1577552` | PMID: `12880052`. Cross-referenced with ISO 226:2003 equal-loudness contours.
- **Study Design & Sample:** Controlled psychoacoustic listening experiments with normal-hearing adult listeners (`N = 10`) rating perceived naturalness (1–10 scale) of speech and music across systematic low-pass, high-pass, bandpass, and spectral-tilt conditions at matched RMS levels.
- **Main Finding:** Music naturalness degrades much more rapidly than speech naturalness when low frequencies below `100–150 Hz` or high frequencies above `5–7 kHz` are removed. However, **balanced symmetrical band-limiting** (simultaneously rolling off lows and highs around a ~`1 kHz` geometric center — the classic "telephone/radio rule" where $f_{low} \times f_{high} \approx 500,000\text{ to }600,000\text{ Hz}^2$) sounds dramatically more balanced and less muffled/tinny than cutting highs or lows alone. Furthermore, human ear sensitivity peaks at `2–4 kHz` due to pinna/ear-canal resonance (ISO 226:2003).
- **Limitations:** Small laboratory sample; used clean linear FIR filters without cabinet resonance or nonlinear harmonic generation.
- **Relevance to Product:** Explains why naive "radio" EQs that merely slap a low-pass filter at `3.5 kHz` sound dark and muffled! By pairing high-pass and low-pass cutoffs symmetrically (`135 Hz × 4,200 Hz ≈ 567,000 Hz²` for Mid-Century AM; `85 Hz × 5,800 Hz ≈ 493,000 Hz²` for Warm Tabletop) and shaping the `2.0–2.5 kHz` cone presence region, the perceived tonal balance stays coherent and intelligible.
- **Confidence:** **High** (well-replicated across telecommunications and psychoacoustics literature).

### 2.2 The "Missing Fundamental" and Small-Speaker Bass Perception

- **Research Question:** How do listeners perceive musical bass lines and vocal fundamental pitches (`80–250 Hz`) on small radio speakers incapable of radiating energy below `300 Hz`?
- **Source & Date:** Winkler, I., Tervaniemi, M., & Näätänen, R. (1997). _Two separate codes for missing-fundamental pitch in the human auditory cortex_. _The Journal of the Acoustical Society of America_, 102(2), 1072–1081. DOI: `10.1121/1.419860` | PMID: `9265755`. Corroborated neurophysiologically by Bendor, D., & Wang, X. (2005), _Nature_, 436(7054), 1161–1165, DOI: `10.1038/nature03867` | PMID: `16121182`.
- **Study Design & Sample:** Auditory event-related potential (mismatch negativity, MMN) recordings in human listeners (`Winkler et al., 1997`) and single-unit recordings in primate auditory cortex (`Bendor & Wang, 2005`).
- **Main Finding:** Pitch-selective neurons in auditory cortex compute fundamental pitch $f_0$ from the spacing of resolved upper harmonics ($2f_0, 3f_0, 4f_0$) even when zero acoustic energy exists at $f_0$.
- **Limitations:** Pure-tone harmonic complexes differ in envelope complexity from dense polyphonic mixes; pure sub-bass sine waves (e.g., modern 808 sub-bass with _no_ upper harmonics) vanish completely under a `350 Hz` high-pass filter unless harmonics are generated _prior_ to or alongside filtering!
- **Relevance to Product:** **Crucial DSP insight:** Modern digital music (especially hip-hop, electronic, and pop) often contains near-sinusoidal sub-bass (`40–90 Hz`) that would completely disappear on our `Transistor Radio` (`360 Hz` HPF) or `Mid-Century AM` (`135 Hz` HPF) profiles if we simply high-passed first! By applying gentle low-level harmonic excitation / transformer saturation _before_ the steep speaker dipole roll-off (modeling how real output transformers saturate on bass before the tiny speaker cone acoustically filters out the fundamental), we generate subtle $2f_0$ and $3f_0$ harmonics (`120–270 Hz` / `360–500 Hz`) so modern bass lines remain musically audible via the missing-fundamental mechanism!
- **Confidence:** **High**.

### 2.3 Nonlinear Harmonic & Intermodulation Distortion Perception

- **Research Question:** At what thresholds do quadratic (even-order) and cubic (odd-order) nonlinearities degrade vs. pleasantly color music and speech?
- **Source & Date:**
  1. Tan, C.-T., Moore, B. C. J., & Zacharov, N. (2003). _The Effect of Nonlinear Distortion on the Perceived Quality of Music and Speech Signals_. _Journal of the Audio Engineering Society_, 51(11), 1012–1031.
  2. Moore, B. C. J., Tan, C.-T., Zacharov, N., & Mattila, V.-V. (2004). _Measuring and Predicting the Perceived Quality of Music and Speech Subjected to Combined Linear and Nonlinear Distortion_. _Journal of the Audio Engineering Society_, 52(12), 1228–1244.
  3. Tan, C.-T., & Moore, B. C. J. (2008). _Perception of nonlinear distortion by hearing-impaired people_. _International Journal of Audiology_, 47(5), 246–256. PMID: `18465409`.
- **Study Design & Sample:** Controlled double-blind rating studies (`N = 10–16` normal-hearing and hearing-impaired listeners) testing hard clipping, soft clipping (`tanh`), quadratic distortion, and crossover notches on speech and polyphonic music.
- **Main Finding:** Hard clipping and zero-crossing crossover notches generate high-order odd harmonics and dense high-frequency intermodulation products that sharply degrade perceived quality at low THD (`1–2%`). Conversely, smooth low-order quadratic (`x²`) and soft-clipping (`tanh`) nonlinearities are masked much more effectively by musical spectra (tolerated well at `2–5%` THD) and, when followed by high-frequency roll-off (as in a physical paper-cone speaker!), lose harsh upper-frequency intermodulation fizz while retaining midrange density.
- **Limitations:** Measured "fidelity/quality" relative to an uncolored reference rather than intentional "vintage character" preference.
- **Relevance to Product:** Validates two key pipeline choices: (1) placing a post-saturation speaker high-frequency damping filter after the waveshaper to tame harsh upper intermodulation fizz, and (2) bounding default THD to `~1.0%–3.5%` at nominal `-12 dBFS` RMS rather than heavy guitar-amp distortion.
- **Confidence:** **High**.

### 2.4 Dynamic Range Compression & Loudness Bias

- **Research Question:** How does dynamic range compression affect perceived loudness, intimacy, and listener preference?
- **Source & Date:** Kirchberger, M., & Russo, F. A. (2016). _Dynamic Range Across Music Genres and the Perception of Dynamic Compression in Hearing-Impaired Listeners_. _Trends in Hearing_, 20, 1–16. DOI: `10.1177/2331216516630549` | PMID: `26868955`.
- **Study Design & Sample:** Experimental listening study (`N = 20` normal-hearing controls, `N = 22` hearing-impaired adults) evaluating multi-genre music excerpts across compression ratios (`1:1`, `3:1`, `8:1`) at RMS-matched levels.
- **Main Finding:** Heavy compression (`8:1`) reduces musical clarity and dynamic contrast when loudness is properly equalized, whereas mild-to-moderate compression (`2:1–3.5:1`) preserves musical quality while stabilizing quiet passages (spoken word, acoustic decays) against background noise. Crucially, when levels are _not_ equalized, listeners systematically confuse louder playback (+1 to +2 dB) with "better" sound quality.
- **Limitations:** Focused on broadband music rather than band-limited broadcast chains.
- **Relevance to Product:** Reinforces our strict requirement for **loudness-matched A/B bypass** and moderate (`1.8:1` to `4:1`) program compression with smooth attack/release constants (`5–20 ms` attack, `150–320 ms` release) rather than brickwall pumping.
- **Confidence:** **High**.

### 2.5 Noise, Hiss, and Spectral Context as Historical Signifiers

- **Research Question:** Why does low-level surface noise or radio static contribute to perceived realism and historical "place," and when does it become annoying?
- **Source & Date:** Harper, A. C. (2014). _Lo-Fi Aesthetics in Popular Music Discourse_. DPhil Thesis, University of Oxford (Oxford University Research Archive). DOI: `10.5287/ora-xq67jm1vx`.
- **Study Design:** Historical and musicological analysis of phonographic, broadcast, and lo-fi recording reception.
- **Main Finding:** Medium-specific imperfections (tube hum, radio static, narrow bandwidth, room resonance) operate culturally as _indexical signs of mediation and temporal distance_ — signaling a physical object in a room rather than disembodied digital audio. However, aesthetic value collapses when noise masks musical detail or persists intrusively during silence.
- **Limitations:** Qualitative cultural/musicological analysis rather than controlled psychophysics.
- **Relevance to Product:** Supports making noise **subtle by default (`-36` to `-48 dBFS`)**, **spectrally shaped** (pink/brownian + band-limited rather than harsh digital white noise), **independently defeatable (true `0%`)**, and **ducked when playback pauses**.
- **Confidence:** **Moderate** (strong cultural/UX consensus; culturally contingent).

---

## 3. Neuroscience of Music-Evoked Autobiographical Memory (MEAMs) & Nostalgia

### 3.1 Behavioral Characteristics of MEAMs & Nostalgia

- **Research Question:** How reliably does music evoke autobiographical memories and nostalgia, and what factors govern whether nostalgia occurs?
- **Sources & Dates:**
  1. Janata, P., Tomic, S. T., & Rakowski, S. K. (2007). _Characterisation of music-evoked autobiographical memories_. _Memory_, 15(8), 845–860. DOI: `10.1080/09658210701734593` | PMID: `17965981`.
  2. Barrett, F. S., Grimm, K. J., Robins, R. W., Wildschut, T., Sedikides, C., & Janata, P. (2010). _Music-evoked nostalgia: Affect, memory, and personality_. _Emotion_, 10(3), 390–403. DOI: `10.1037/a0019006` | PMID: `20515227`.
  3. Belfi, A. M., Karlan, B., & Tranel, D. (2016; online 2015). _Music evokes vivid autobiographical memories_. _Memory_, 24(7), 979–989. DOI: `10.1080/09658211.2015.1061012` | PMID: `26259098`.
- **Study Designs & Samples:**
  - `Janata et al. (2007)`: `N = 329` undergraduate participants hearing random billboard excerpts (`30s`); ~30% of trials evoked autobiographical memories, predominantly positive/nostalgic (`mixed bittersweet` affect).
  - `Barrett et al. (2010)`: `N = 226` listeners across 6,780 song-rating trials with multilevel modeling of song vs. person-level variance.
  - `Belfi et al. (2016)`: `N = 30` healthy adults comparing memories evoked by popular songs vs. famous faces (`30` stimuli each), coded for episodic detail and vividness.
- **Main Findings:**
  1. Music evokes significantly more vivid, perceptually rich autobiographical memories than visual face cues (`Belfi et al., 2016`).
  2. Crucially, `Barrett et al. (2010)` demonstrated that music-evoked nostalgia is driven primarily by **idiosyncratic person-by-song autobiographical association and familiarity**, modulated by trait nostalgia proneness — **not** by acoustic/timbral properties alone!
- **Limitations:** Primarily Western university and adult cohorts; tested song selection rather than real-time vintage playback filtering of arbitrary songs.
- **Relevance to Product:** **Directly governs product honesty:** We must _never_ claim that applying a vintage radio filter automatically triggers nostalgia. Rather, the filter creates an _intimate, historically evocative acoustic framing_ that may heighten atmosphere when paired with music meaningful to the listener.
- **Confidence:** **High**.

### 3.2 Neural Correlates & Individual Differences

- **Research Question:** Which brain networks engage during music-evoked nostalgia, and how much do individuals vary in musical reward and emotional response?
- **Sources & Dates:**
  1. Janata, P. (2009). _The neural architecture of music-evoked autobiographical memories_. _Cerebral Cortex_, 19(11), 2579–2594. PMID: `19240137`.
  2. Barrett, F. S., & Janata, P. (2016). _Neural responses to nostalgia-evoking music modeled by elements of dynamic musical structure and individual differences in affective traits_. _Neuropsychologia_, 91, 234–246. DOI: `10.1016/j.neuropsychologia.2016.08.012` | PMID: `27526666`.
  3. Hennessy, S., Janata, P., Ginsberg, T., & Kaplan, J. (2025). _Music-Evoked Nostalgia Activates Default Mode and Reward Networks Across the Lifespan_. _Human Brain Mapping_, 46(4). DOI: `10.1002/hbm.70181` | PMID: `40083173`.
  4. Martínez-Molina, N., Mas-Herrero, E., Rodríguez-Fornells, A., & Zatorre, R. J. (2016). _Neural correlates of specific musical anhedonia_. _PNAS_, 113(46), E7337–E7345. PMID: `27799544`; and (2019), _Journal of Neuroscience_, 39(25), 5018–5027, DOI: `10.1523/JNEUROSCI.2020-18.2019` | PMID: `31000588`.
- **Study Designs & Samples:** fMRI neuroimaging cohorts (`N = 13` in Janata 2009; `N = 18` in Barrett & Janata 2016; `N = 57` young & older adults in Hennessy et al. 2025; `N = 38–45` stratified by Barcelona Music Reward Questionnaire in Martínez-Molina et al. 2016/2019).
- **Main Findings:**
  1. Nostalgia-evoking music co-activates the **Default Mode Network (DMN)** (medial prefrontal cortex, posterior cingulate, hippocampus — supporting self-referential autobiographical retrieval) alongside subcortical **reward circuitry** (`Hennessy et al., 2025`).
  2. Neural responses to nostalgic music depend strongly on **individual differences** in trait nostalgia proneness (`Barrett & Janata, 2016`) and structural/functional connectivity between auditory cortex and ventral striatum (`Martínez-Molina et al., 2016, 2019`), with ~3–5% of healthy listeners exhibiting specific musical anhedonia despite normal hearing.
- **Limitations:** fMRI BOLD signals measure hemodynamic blood-oxygenation correlates — **they do not directly measure synaptic dopamine or serotonin release**, and sample sizes (`N = 13–57`) cannot support deterministic individual predictions.
- **Relevance to Product:** Establishes strict scientific guardrails:
  1. **Zero neurochemical claims** in UI copy or documentation.
  2. **Multiple distinct sonic profiles + adjustable Intensity (`0–100%`) and Noise (`0–100%`)**, respecting large inter-individual differences in preference for bandwidth restriction and surface noise.

---

## 4. Testable Empirical Evaluation Protocol

Because subjective warmth, intimacy, and nostalgia vary by listener and program material, our Workbench (`workbench.html`) and documentation define a fair, blindable **Loudness-Matched A/B Evaluation Protocol**:

1. **Loudness Calibration:** Match Processed and Bypass paths within `±0.8 dB` RMS on pink noise so loudness bias (`Kirchberger & Russo, 2016`) cannot confound preference ratings.
2. **Program Diversity:** Evaluate each preset across 4 reference categories: (a) Male & female conversational speech/podcasts, (b) 1950s–1960s jazz/vocal recordings, (c) Modern sub-bass-heavy pop/electronic music, and (d) Solo acoustic piano/guitar.
3. **Subjective Dimensions (5-point Likert):** Perceived warmth, vocal intelligibility, listening comfort (lack of ear fatigue), convincingness as a physical receiver, and optional mood/atmosphere shift.
