const FEEDBACK_LIFETIME = 0.9;

function cloneFeedback(feedback) {
  return feedback ? { ...feedback } : null;
}

export function createTorusTutorialState(missionId = "seam") {
  return {
    missionId,
    wrapSeen: false,
    pulseSeen: false,
    orientationFlipSeen: false,
    bankedSigns: [],
    feedback: null,
    feedbackQueue: [],
    feedbackLeft: 0,
    authoredSignDiscovery: false,
  };
}

export function resetTorusTutorial(state, missionId) {
  Object.assign(state, createTorusTutorialState(missionId));
  return state;
}

export function updateTorusTutorial(state, game, events = [], dt = 0) {
  if (state.missionId !== game.mission.id) resetTorusTutorial(state, game.mission.id);
  state.feedbackLeft = Math.max(0, state.feedbackLeft - dt);
  if (state.feedbackLeft === 0) state.feedback = null;

  const queueFeedback = (feedback) => {
    state.feedbackQueue.push(feedback);
  };

  for (const event of events) {
    if (event.type === "wrap") {
      state.wrapSeen = true;
      queueFeedback({ type: "wrap", title: "SEAM CONNECTED", detail: "The ship re-entered from the opposite edge." });
    } else if (event.type === "pulse") {
      state.pulseSeen = true;
      queueFeedback({ type: "pulse", title: "SOURCE BEARINGS REVEALED", detail: "Follow each ring back to its cyan source." });
    } else if (event.type === "orientation") {
      state.orientationFlipSeen = true;
      queueFeedback({
        type: "orientation",
        sign: event.orientation,
        title: event.orientation > 0 ? "ORIENTATION +" : "ORIENTATION −",
        detail: "The trail color and area sign changed together.",
      });
    } else if (event.type === "collect") {
      state.bankedSigns.push(event.sign);
      if (event.gate.requiredOrientation !== event.sign) state.authoredSignDiscovery = true;
      queueFeedback({
        type: "collect",
        sign: event.sign,
        title: event.sign > 0 ? "+ BANKED" : "− BANKED",
        detail: `${event.gate.label} took the sign of the ground beneath the ship.`,
      });
    }
  }
  if (!state.feedback && state.feedbackQueue.length > 0) {
    state.feedback = state.feedbackQueue.shift();
    state.feedbackLeft = FEEDBACK_LIFETIME;
  }
  return state;
}

export function torusTutorialView(state, game) {
  const mission = game.mission;
  const collected = game.collected.length;
  const total = mission.gates.length;
  const base = {
    phase: mission.id,
    step: `MISSION ${mission.number}`,
    command: mission.objective,
    detail: mission.hint,
    bankedSigns: [...state.bankedSigns],
    feedback: cloneFeedback(state.feedback),
    reveal: {
      orientation: true,
      multiplicity: mission.id === "echo" || mission.id === "cancel" || mission.id === "free",
      density: mission.id !== "seam" || state.orientationFlipSeen,
      packet: collected > 0 || !["seam", "reverse"].includes(mission.id),
      correspondence: mission.id !== "seam",
      fieldEffect: mission.id !== "seam",
      camera: mission.id === "free",
    },
  };

  if (mission.id === "seam") {
    if (!state.wrapSeen) {
      return {
        ...base,
        phase: "seam-wrap",
        step: "STEP 1 · CROSS THE EDGE",
        command: "HOLD EAST  →",
        detail: "Fly through the glowing right edge. Do not turn back.",
      };
    }
    if (collected === 0) {
      return {
        ...base,
        phase: "seam-first-relay",
        step: "STEP 2 · TAKE THE FIRST CARGO",
        command: "TOUCH ①",
        detail: "It is waiting where you re-entered.",
      };
    }
    return {
      ...base,
      phase: "seam-cargo",
      step: `STEP 2 · CARGO ${collected} / ${total}`,
      command: collected < total ? `TOUCH ${["①", "②", "③", "④"][collected]}` : "CARGO COMPLETE",
      detail: state.authoredSignDiscovery
        ? "The ground decides + or − at the instant of collection."
        : "Follow the bright numbered ring; the dim rings are the route ahead.",
      reveal: { ...base.reveal, packet: collected >= total },
    };
  }

  if (mission.id === "reverse") {
    const commands = ["TOUCH THE + LOCK", "CROSS AMBER · TOUCH THE − LOCK", "CROSS BACK · TOUCH THE + LOCK"];
    return {
      ...base,
      phase: "fold-orientation",
      step: `STEP 3 · SIGN ${collected} / ${total}`,
      command: commands[Math.min(collected, commands.length - 1)],
      detail: "Cyan ground adds area. Coral ground subtracts it. Amber is the zero boundary.",
    };
  }

  if (mission.id === "echo") {
    return {
      ...base,
      phase: state.pulseSeen ? "provenance-trace" : "provenance-pulse",
      step: "STEP 4 · FIND THREE SOURCES",
      command: state.pulseSeen ? "TOUCH ALL THREE CYAN RINGS" : "PRESS SPACE · SEND PULSE",
      detail: state.pulseSeen
        ? "Three different source positions cast one white shadow on the sphere."
        : "The pulse draws bearings to every source of the same white point.",
    };
  }

  if (mission.id === "cancel") {
    return {
      ...base,
      phase: "signed-cancel",
      step: `STEP 5 · CANCEL ${collected} / ${total}`,
      command: collected < total ? `TOUCH LOCK ${collected + 1}` : "SIGNED SUM COMPLETE",
      detail: "Every pickup stamps its actual + or − into the bank below.",
    };
  }

  return {
    ...base,
    phase: "free-route",
    step: `STEP 6 · FREE ROUTE ${collected} / ${total}`,
    command: collected < total ? "CHOOSE THE NEXT RING" : "RETURN TO HOME",
    detail: "Collect every ring, keep signed sum +1, then close the route at HOME.",
  };
}

export function createTraceTutorialState(mode = "continuation") {
  return {
    mode,
    firstActionSeen: false,
    transitionCount: 0,
    lastEvent: null,
  };
}

export function resetTraceTutorial(state, mode) {
  Object.assign(state, createTraceTutorialState(mode));
  return state;
}

export function updateTraceTutorial(state, game, events = []) {
  if (state.mode !== game.mode) resetTraceTutorial(state, game.mode);
  for (const event of events) {
    if (["edge-correct", "pair-born", "pair-died", "runner-pair-correct"].includes(event.type)) {
      state.firstActionSeen = true;
    }
    if (["transition-clear", "runner-stage-clear"].includes(event.type)) state.transitionCount += 1;
    state.lastEvent = event.type;
  }
  return state;
}

export function continuationTutorialView(state, game, view) {
  const requiredEdges = view?.task.shared.length ?? 0;
  const solvedEdges = game.solvedEdges.length;
  const pairRequired = (view?.task.pairIds.length ?? 0) === 2;
  const total = requiredEdges + Number(pairRequired);
  const done = solvedEdges + Number(pairRequired && game.pairSolved);

  if (!game.selected) {
    if (solvedEdges < requiredEdges) {
      return {
        phase: "a-pick-left",
        command: "CLICK ANY ROOT ON THE LEFT",
        detail: "Then click the same ID on the right to fire a continuation beam.",
        progress: { done, total },
      };
    }
    if (pairRequired && !game.pairSolved) {
      return {
        phase: "a-lock-pair",
        command: "CLICK THE + AND − THAT APPEAR OR DISAPPEAR",
        detail: `Choose both on the ${view.task.pairLayer === "previous" ? "left" : "right"} panel.`,
        progress: { done, total },
      };
    }
  }

  if (game.selected) {
    const other = game.selected.layer === "previous" ? "RIGHT" : "LEFT";
    return {
      phase: "a-match-id",
      command: `CLICK ${game.selected.id} ON THE ${other}`,
      detail: "Matching labels continue one physical sheet through time.",
      progress: { done, total },
    };
  }

  return {
    phase: "a-transition",
    command: "TRANSITION LOCKED",
    detail: "The next two frames are sliding into place.",
    progress: { done, total },
  };
}

export function runnerTutorialView(state, game) {
  const stage = game.stages[game.stageIndex];
  if (!stage) return { phase: "b-complete", command: "TRACE COMPLETE", detail: "All three path contracts passed." };
  if (game.inputLock > 0) {
    return {
      phase: "b-look",
      command: "WATCH: WHITE TARGET → CYAN ROOTS",
      detail: "Controls unlock after the start and goal are both visible.",
    };
  }
  if (stage.id === "preserve") {
    return {
      phase: "b-preserve",
      command: "STEER AROUND AMBER · REACH GOAL",
      detail: "WASD or arrows move the white target. Keep ROOTS at 1.",
    };
  }
  if (stage.id === "forge") {
    if (game.roots.length < 3) {
      return {
        phase: "b-forge-cross",
        command: "CROSS ONE AMBER ARM",
        detail: "When ROOTS jumps 1 → 3, two newborn roots will flash.",
      };
    }
    if (!game.pairTagged) {
      return {
        phase: "b-forge-tag",
        command: "CLICK THE TWO FLASHING NEW ROOTS",
        detail: "Tag the +/− pair born at this fold crossing.",
      };
    }
    return { phase: "b-forge-goal", command: "MOVE INTO THE GOAL RING", detail: "The newborn pair is tagged." };
  }
  if (!game.pairTagged && game.roots.length === 3) {
    return {
      phase: "b-exchange-tag",
      command: "CLICK S₀⁺ AND THE − ROOT",
      detail: "Mark the pair that must disappear at the opposite arm.",
    };
  }
  return {
    phase: "b-exchange-exit",
    command: "EXIT THROUGH THE OTHER AMBER ARM",
    detail: "Reach the goal with one root whose ID is not the starting ID.",
  };
}
