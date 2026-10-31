# Historical Radio Research: Transmission, Receivers, and Electroacoustics

## 1. Scope & Historical Perspective

"Vintage radio" is not a single acoustic transfer function. Across the 20th century, the sound of radio varied substantially by region (North American 10 kHz medium-wave spacing vs. European/Asian 9 kHz spacing and longwave service), era (1920s battery TRF sets, 1930s–1950s AC/DC tabletop tube superheterodynes, 1950s–1970s pocket germanium transistor portables, 1960s–1970s hi-fi FM tuners), price tier, and propagation path (local groundwave vs. nighttime ionospheric skywave).

Critically, the sound reaching a listener's ears is the **cascade of two distinct physical systems**:

1. **Broadcast Chain & RF/IF Transmission Artifacts:** Pre-transmitter audio limiting/compression, pre-emphasis/de-emphasis, carrier modulation limits, intermediate-frequency (IF) transformer selectivity skirts, envelope-detector nonlinearity, atmospheric/thermal RF noise, and multipath fading.
2. **Receiver Audio Amplifier, Loudspeaker & Enclosure Coloration:** Output transformer core saturation, vacuum-tube or bipolar-transistor harmonic distortion, power-supply mains hum ripple, paper-cone breakup modes, voice-coil inductance, and open-back wooden or miniature plastic baffle resonances.

Below we examine eight historically significant categories, separating **[Documented Specifications]** from **[Electroacoustic Estimates]** and **[Engineering Voicing Decisions]**.

---

## 2. Historical Receiver & Broadcast Categories

### 2.1 Early AM Broadcast Receivers (1920s–Early 1930s)

- **Representative Hardware:** Atwater Kent Model 20 (1924, Tuned Radio Frequency [TRF] battery receiver with external horn or early moving-iron cone speaker); RCA Radiola 18 (1928).
- **Documented Characteristics:**
  - TRF stages used cascaded LC tuned circuits whose bandwidth widened significantly at the top of the medium-wave band (1500 kHz) compared to the bottom (550 kHz).
  - Early moving-iron ("magnetic armature") horns and pin-drive paper cones exhibited sharp mechanical resonances between **400 Hz and 2.5 kHz** with steep roll-off below **250 Hz** and above **3.0 kHz** (Olson, 1957).
- **Relevance to Product:** Too narrow and resonant ("tin-horn" coloration) for comfortable prolonged music listening as a primary preset, though informative as an extreme bound.

### 2.2 Mid-Century Domestic AM Tabletop Tube Radios (1935–1960)

- **Representative Hardware:** The North American **"All-American Five" (AA5)** superheterodyne topology (e.g., Emerson 520, Philco Transitone 46-200, Zenith Consol-Tone series) utilizing octal `12SA7–12SK7–12SQ7–50L6GT–35Z5GT` or miniature 7-pin `12BE6–12BA6–12AV6–50C5–35W4` series-strung heater tubes.
- **Documented Specifications:**
  - **Channel & IF Selectivity:** Medium-wave channels spaced at **10 kHz** (Region 2 / FCC) or **9 kHz** (Regions 1 & 3 / ITU). Standard **455 kHz** double-tuned permeability/capacitor IF transformers yielded a `-6 dB` RF passband of **7 kHz – 9 kHz**, corresponding to a demodulated audio `-6 dB` cutoff of **3.5 kHz – 4.5 kHz**, dropping at roughly **18–24 dB/octave** above 5 kHz (_Radiotron Designer's Handbook_, 4th ed., 1953, Ch. 9 & Ch. 26).
  - **Audio Output Stage (`50L6GT` / `50C5`):** Single-ended Class-A beam power pentode delivering **1.0 – 1.5 W** continuous output at **5% – 10% THD** at full rated power, and **1.5% – 3.5% THD** (predominantly 2nd harmonic from single-ended plate curvature, plus 3rd harmonic from small-core output transformer hysteresis) at normal domestic listening levels (~100–250 mW) (RCA Receiving Tube Manual RC-19).
  - **Output Transformer & Power Supply:** Transformerless AC/DC half-wave rectification (`35Z5GT` / `35W4`) filtered by dual `30 µF – 50 µF` electrolytic capacitors produced residual **60 Hz** (or 50 Hz) fundamental heater/cathode hum and **120 Hz** (or 100 Hz) half-wave ripple. Small-core audio output transformers saturated on heavy bass below **110–140 Hz**.
  - **Reproduction:** Strictly **monaural**.
- **Electroacoustic Estimates (Speaker & Baffle):**
  - A 4-inch to 5-inch permanent-magnet (Alnico V) paper-cone speaker mounted in an open-back Bakelite, Plaskon, or wood-veneer cabinet acts as an acoustic dipole at wavelengths exceeding the effective baffle path length ($L \approx 0.25\text{–}0.35\text{ m}$), producing a `6–12 dB/octave` acoustic cancellation below **130–180 Hz** combined with transformer roll-off, and an open-back cavity/panel resonance hump around **280 Hz – 380 Hz** (`+3 to +4.5 dB`, $Q \approx 1.5\text{–}2.0$) (estimated via Olson, 1957, Ch. 6).

### 2.3 Larger Domestic Tabletop & European Console Tube Receivers (1950s–1960s)

- **Representative Hardware:** Braun SK 4 / SK 5 (1956, Dieter Rams & Hans Gugelot, wood/sheet-metal enclosure), Telefunken Opus 6 / Gavotte, Zenith H725 AM/FM tabletop.
- **Documented & Estimated Characteristics:**
  - Employed larger 6-inch to 8-inch high-efficiency oval paper-cone drivers (often paired with an electrostatic or cone tweeter on FM-capable sets), larger output transformers (`EL84` / `6BQ5` or `6V6GT`), and heavier wooden cabinets.
  - Bass extension reached **80 Hz – 100 Hz** before open-back roll-off; upper response on wide-AM or early FM extended cleanly to **5.5 kHz – 7.5 kHz** with a warm wood-cabinet resonance centered lower (**200 Hz – 260 Hz**) and lower harmonic distortion (**1% – 2.5% THD**).
  - **Relevance to Product:** Provides the most balanced, fatigue-free "warm vintage radio" voicing for modern music and spoken word without sacrificing bass foundation or intelligibility.

### 2.4 Portable Transistor Radios (1954–1980s)

- **Representative Hardware:** **Regency TR-1** (1954, TI/I.D.E.A. — four grown-junction NPN germanium transistors, 22.5V battery, **262 kHz** IF strip with tuned-primary/untuned-secondary transformers and CK706A germanium diode detector); **Sony TR-63** (1957, 6-transistor pocket superhet with Class-B push-pull transformer-coupled audio output).
- **Documented Specifications:**
  - Early pocket sets used **262 kHz** (TR-1) or **455 kHz** (TR-63) miniature single-tuned IF cans with `-6 dB` audio bandwidth around **3.0 kHz – 3.8 kHz**.
  - **Class-B Push-Pull Germanium Output:** Driven by miniature driver and output transformers into a **2.25-inch to 2.75-inch** loudspeaker (`50–150 mW` max output). Germanium junction forward threshold ($V_{BE} \approx 0.15\text{–}0.2\text{ V}$) under minimal quiescent bias (to save 9V battery drain) introduced mild odd-order crossover nonlinearity alongside battery-sag soft clipping on peaks.
- **Electroacoustic Estimates:**
  - A 2.25-inch stiff paper cone in a palm-sized polystyrene enclosure has a high fundamental mechanical resonance ($f_s \approx 320\text{–}420\text{ Hz}$), virtually zero output below **350 Hz** (`-18 dB/octave`), and a pronounced upper-midrange cone resonance between **1.6 kHz and 2.6 kHz** (`+4 to +6 dB`). Listener perception of bass pitch relies almost entirely on harmonic overtones triggering the missing-fundamental effect.

### 2.5 Historical Shortwave & Nighttime Skywave AM (DX Reception)

- **Representative Hardware:** Zenith Trans-Oceanic (tube `H500` / solid-state `Royal 1000/3000`), Hallicrafters S-38.
- **Documented Propagation & Receiver Phenomena:**
  - After sunset, D-layer ionospheric absorption vanishes and medium-wave/shortwave signals reflect off the F-layer hundreds of kilometers overhead.
  - **Selective Fading:** Interference between groundwave and skywave (or multiple ionospheric paths) produces slowly drifting phase-cancellation notches sweeping across the audio spectrum at **0.05 Hz – 0.25 Hz**, periodically altering spectral tilt and AGC gain.
  - **Atmospheric Noise (Sferics):** Dominated not by flat white noise, but by pink/red-tilted atmospheric static from distant lightning activity combined with receiver mixer hiss.

### 2.6 Vintage FM Broadcast & Receivers (1960s–1980s)

- **Documented Standards (FCC / ITU-R BS.450):**
  - Audio passband **30 Hz – 15 kHz** (brickwall low-pass filtered below the **19 kHz** stereo pilot tone).
  - Transmitter **pre-emphasis** (`75 µs` time constant = `2,122 Hz` corner in Americas; `50 µs` = `3,183 Hz` in Europe) paired with receiver **de-emphasis** (`-6 dB/octave` above corner), suppressing triangular FM demodulator hiss.
  - **Broadcast Processing:** From early tube limiters (Western Electric 1126, Gates Sta-Level) to Bob Orban's **Optimod-FM 8000** (1975), stations applied pre-emphasis-aware multiband compression and peak limiting, producing a dense, intimate, consistent vocal presence ("FM late-night DJ sound").

---

## 3. Reconstructed Parameter Reference Table

All parameters below distinguish documented hardware constraints from reconstructed DSP targets:

| Sonic Dimension            | Profile A: Mid-Century AM                             | Profile B: Warm Tabletop                                | Profile C: Transistor Radio                                 | Profile D: Late-Night Radio                               | Profile E: Clean Vintage                                  |
| -------------------------- | ----------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| **Historical Inspiration** | 1940s–50s AA5 (`50L6GT`, 5" speaker, 455 kHz IF)      | 1950s–60s wood-cabinet tabletop (`Braun SK` / `Zenith`) | 1957–70s pocket portable (`Sony TR-63` / `TR-1`, 2.5" cone) | Nighttime skywave AM / intimate late-night broadcast      | Studio broadcast tape/limiter chain into hi-fi monitor    |
| **High-Pass Cutoff**       | `135 Hz` (24 dB/oct) _(Est. baffle + xfrmr)_          | `85 Hz` (12 dB/oct) _(Est. larger wood cabinet)_        | `360 Hz` (24 dB/oct) _(Est. 2.5" cone fs)_                  | `120 Hz` (12 dB/oct) _(Voiced for warmth)_                | `55 Hz` (12 dB/oct) _(Sub-rumble trim)_                   |
| **Low-Pass Cutoff**        | `4,200 Hz` (24 dB/oct) _(Doc. 455 kHz IF skirt)_      | `5,800 Hz` (12 dB/oct) _(Est. wide-AM / warm cone)_     | `3,300 Hz` (24 dB/oct) _(Doc./Est. miniature IF + cone)_    | `4,600 Hz` (18 dB/oct) _(Voiced dark & intimate)_         | `9,200 Hz` (12 dB/oct) _(Gentle 75µs-style air roll-off)_ |
| **Enclosure Resonance**    | `320 Hz`, `+3.2 dB`, `Q=1.6` _(Est. open-back box)_   | `225 Hz`, `+3.0 dB`, `Q=1.1` _(Est. wood cavity)_       | `1,150 Hz`, `+3.5 dB`, `Q=1.8` _(Est. plastic pocket body)_ | `250 Hz`, `+2.8 dB`, `Q=1.2` _(Artistic warmth)_          | `190 Hz`, `+1.4 dB`, `Q=0.8` _(Subtle body)_              |
| **Vocal/Cone Presence**    | `2,450 Hz`, `+2.4 dB`, `Q=1.3` _(Cone breakup)_       | `2,100 Hz`, `+1.4 dB`, `Q=0.9` _(Balanced clarity)_     | `2,350 Hz`, `+4.2 dB`, `Q=2.1` _(Paper cone peak)_          | `1,950 Hz`, `+1.6 dB`, `Q=1.1` _(Intimate speech)_        | `2,800 Hz`, `+0.8 dB`, `Q=0.7` _(Subtle presence)_        |
| **Saturation Model**       | Asymmetric Tube (`2nd + 3rd` order, moderate drive)   | Asymmetric Tube (gentle drive, warm 2nd harmonic)       | Germanium Push-Pull (mild odd-order + soft peak clip)       | Warm Soft-Tanh (smooth compression saturation)            | Clean Chebyshev Warmth (`<1.2%` THD)                      |
| **Dynamic Processing**     | Broadcast AM limiter (`-15 dBFS`, `4:1`, `5ms/160ms`) | Gentle tube program (`-18 dBFS`, `2.5:1`, `12ms/240ms`) | Fast battery-sag limiter (`-13 dBFS`, `5:1`, `3ms/90ms`)    | Broadcast AGC density (`-17 dBFS`, `3.5:1`, `10ms/320ms`) | Transparent leveling (`-20 dBFS`, `1.8:1`, `20ms/300ms`)  |
| **Channel / Stereo Width** | `0.0` (True Mono) _(Doc.)_                            | `0.15` (Near-Mono; avoids hard phase-cancel shock)      | `0.0` (True Mono) _(Doc.)_                                  | `0.35` (Narrowed intimate stereo) _(Artistic)_            | `0.65` (Cohesive vintage stereo) _(Artistic)_             |
| **Default Noise Spectrum** | Band-limited Pink + subtle `60/120 Hz` hum            | Low-level warm Pink hiss + trace hum                    | Band-limited RF hiss (no mains hum — battery powered!)      | Atmospheric Pink/Brown hiss + slow sferic crackle         | `0.0` default (noise-free unless user raises slider)      |
| **Optional Tuning Drift**  | Subtle IF skirt drift (`0.10` default)                | Off (`0.0` default)                                     | Subtle alignment drift (`0.08` default)                     | Gentle ionospheric selective fade (`0.28` default)        | Off (`0.0` default)                                       |

_Note a crucial historical detail caught by our analysis:_ **Transistor portables ran on 9V or 22.5V DC batteries**, so they had **zero AC mains 60/120 Hz hum**! Injecting 60 Hz power-supply hum into a pocket transistor profile (as naive implementations do) is both physically wrong and muddies the high-pass response. Our noise generator models mains hum _only_ on AC mains-powered tube profiles!

---

## 4. Recommendation for Initial Sound Profile

**Recommended Initial Default Profile: Profile B — Warm Vintage Tabletop (`warm-tabletop`)**

### Rationale:

1. **Immediate Cross-Material Musicality:** Users test browser audio extensions on wildly diverse content — modern bass-heavy pop/hip-hop on Spotify/YouTube, spoken-word podcasts, acoustic jazz, and film dialogue. Starting on an aggressive `360 Hz – 3.3 kHz` pocket transistor filter causes new users to think the extension sounds "thin" or "broken" on modern music, whereas **Warm Vintage Tabletop** (`85 Hz – 5.8 kHz`, `225 Hz` wooden enclosure warmth, gentle asymmetric tube harmonics, subtle `-45 dBFS` warm room tone) sounds immediately intentional, rich, intimate, and unmistakably vintage on every genre.
2. **Low Listener Fatigue:** Preserves low-mid musical fundamentals while rolling off harsh digital sibilance above `5.8 kHz`, aligning with Moore & Tan's (2003) findings on perceived naturalness under bandwidth restriction.
3. **Clear Contrast Across Adjacent Presets:** From `Warm Tabletop`, switching one step left to `Mid-Century AM` or `Pocket Transistor` demonstrates dramatic historical band-limiting, while switching right to `Late-Night Radio` or `Clean Vintage` offers atmospheric or subtle mastering-grade coloration.
