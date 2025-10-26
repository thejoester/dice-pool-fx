/* ===============================================================================
    Dice Pool FX
    - Plays a sound if a roll has 2+ dice and ALL dice are max OR ALL dice are 1.
    - Foundry VTT v12+. 
=============================================================================== */
"use strict";

const MOD_ID = "dice-pool-fx";
const SETTING_MAX = "maxRollSound";
const SETTING_MIN = "minRollSound";

const DEBUG = false;
const log = (...args) => { if (DEBUG) console.log("DicePoolFX |", ...args); };

Hooks.once("init", () => {
	try {
		game.settings.register(MOD_ID, SETTING_MAX, {
			name: "Dice Pool FX — Max Roll Sound",
			hint: "Audio file to play when ALL dice in a multi-die roll show their maximum faces (e.g., 1d8+1d6 → 8 and 6).",
			scope: "world",
			config: true,
			type: String,
			default: "",
			filePicker: "audio"
		});

		game.settings.register(MOD_ID, SETTING_MIN, {
			name: "Dice Pool FX — Min Roll Sound",
			hint: "Audio file to play when ALL dice in a multi-die roll are minimum (all 1s) across 2+ dice.",
			scope: "world",
			config: true,
			type: String,
			default: "",
			filePicker: "audio"
		});

		log("Settings registered.");
	} catch (err) {
		console.error(`${MOD_ID} | Failed to register settings`, err);
	}
});

/* Extract all non-discarded die results from a ChatMessage's rolls. */
function extractDieResults(chatMessage) {
	const out = [];
	const rolls = chatMessage?.rolls ?? [];
	for (const roll of rolls) {
		// Roll#dice: array of Die terms.
		const diceTerms = roll?.dice ?? [];
		for (const die of diceTerms) {
			const faces = Number(die?.faces ?? 0);
			if (!faces || !Array.isArray(die?.results)) continue;

			for (const r of die.results) {
				// Ignore discarded / inactive results
				if (r?.discarded || r?.active === false) continue;
				const val = Number(r?.result ?? NaN);
				if (Number.isFinite(val)) {
					out.push({ result: val, max: faces });
				}
			}
		}
	}
	return out;
}

/*
    Determine if a group of results qualifies as "all max" or "all min".
    Requires 2+ dice results total to trigger.
 */
function analyze(results) {
	if (!Array.isArray(results) || results.length < 2) return { allMax: false, allMin: false };
	let allMax = true;
	let allMin = true;

	for (const { result, max } of results) {
		if (result !== max) allMax = false;
		if (result !== 1)   allMin = false;
		if (!allMax && !allMin) break;
	}
	return { allMax, allMin };
}

async function playSound(src) {
	if (!src) return;
	try {
		await foundry.audio.AudioHelper.play({
			src,
			volume: 1.0,
			autoplay: true,
			loop: false
		});
	} catch (err) {
		console.error(`${MOD_ID} | Failed to play sound`, src, err);
	}
}

Hooks.on("createChatMessage", async (message) => {
	try {
		// Ignore non-roll messages quickly
		if (!message?.isRoll || !(message?.rolls?.length > 0)) return;

		const results = extractDieResults(message);
		if (results.length < 2) {
			log("Only one die (or none) detected; no FX.");
			return;
		}

		const { allMax, allMin } = analyze(results);
		log("Results:", results, "allMax:", allMax, "allMin:", allMin);

		if (allMax) {
			const src = game.settings.get(MOD_ID, SETTING_MAX) || "";
			log("All MAX detected. Playing:", src);
			await playSound(src);
		} else if (allMin) {
			const src = game.settings.get(MOD_ID, SETTING_MIN) || "";
			log("All MIN detected. Playing:", src);
			await playSound(src);
		}
	} catch (err) {
		console.error(`${MOD_ID} | Error in dicePoolFX createChatMessage hook`, err);
	}
});