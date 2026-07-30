export const CURVATURE_CONVENTION = Object.freeze({
  chart: "z=x+iy",
  scale: "S=1+|z|²",
  metric: "g_zbarz=∂z∂z̄ log S=1/S²",
  berry: "F_B=ω_FS=i dz∧dz̄/S²",
  ricci: "ρ=−i∂∂̄ log g_zbarz=2ω_FS",
  sign: "positive-curvature convention L≅O(1); choosing O(−1) reverses F_B",
});

export const CURVATURE_MISSIONS = Object.freeze([
  {
    id: "patch",
    number: "01",
    kicker: "CP¹ PATCH · BUILD THE METRIC",
    title: "Differentiate the object you already computed",
    brief: "At z=1, carry log S through two complex derivatives. Every hit must make the next equality true.",
    questions: [
      {
        id: "patch-scale",
        before: "z=1,  S=1+|z|²",
        prompt: "What number enters every denominator?",
        choices: ["S=1", "S=2", "S=4"],
        correct: 1,
        after: "z=1  ⇒  S=2",
        reason: "|1|²=1, so S=1+1=2.",
      },
      {
        id: "patch-first-derivative",
        before: "Φ(z,z̄)=log S",
        prompt: "Fire ∂z. Which expression survives?",
        choices: ["∂zΦ=z/S", "∂zΦ=z̄/S", "∂zΦ=1/S²"],
        correct: 1,
        after: "∂z log S = z̄/S",
        reason: "∂zS=z̄, followed by the chain rule for log S.",
      },
      {
        id: "patch-second-derivative",
        before: "∂zΦ=z̄/S",
        prompt: "Now fire ∂z̄. Complete the quotient calculation.",
        choices: ["g_z z̄=1/S", "g_z z̄=|z|²/S²", "g_z z̄=1/S²"],
        correct: 2,
        after: "g_z z̄=∂z̄(z̄/S)=1/S²",
        reason: "1/S−|z|²/S²=(S−|z|²)/S²=1/S².",
      },
      {
        id: "patch-value",
        before: "g_z z̄=1/S²,  z=1",
        prompt: "Shoot the actual metric coefficient at the chosen point.",
        choices: ["g_z z̄=1/2", "g_z z̄=1/4", "g_z z̄=1"],
        correct: 1,
        after: "g_z z̄(1)=1/4",
        reason: "The previous hit fixed S=2, so 1/S²=1/4.",
      },
    ],
  },
  {
    id: "curvatures",
    number: "02",
    kicker: "TWO BUNDLES · TWO CURVATURES",
    title: "Do not let Berry and Ricci trade names",
    brief: "Charge the eigenline once and the tangent bundle twice from the same Fubini–Study patch.",
    questions: [
      {
        id: "berry-form",
        before: "F_B=ω_FS=i g_z z̄ dz∧dz̄",
        prompt: "Insert the metric coefficient you just derived.",
        choices: ["F_B=i dz∧dz̄/S", "F_B=i dz∧dz̄/S²", "F_B=2i dz∧dz̄/S²"],
        correct: 1,
        after: "F_B=ω_FS=i dz∧dz̄/S²",
        reason: "This lane is the Chern curvature of L≅O(1) in the locked positive convention.",
      },
      {
        id: "complex-to-real",
        before: "i dz∧dz̄ = ? · dx∧dy",
        prompt: "Convert the two-form to the real chart.",
        choices: ["−2 dx∧dy", "dx∧dy", "2 dx∧dy"],
        correct: 2,
        after: "F_B=2 dx∧dy/S²",
        reason: "dz∧dz̄=−2i dx∧dy, hence multiplication by i gives +2 dx∧dy.",
      },
      {
        id: "ricci-log",
        before: "g_z z̄=1/S²",
        prompt: "Ricci acts on log det g. What is log g_z z̄?",
        choices: ["−2 log S", "−log S", "2 log S"],
        correct: 0,
        after: "log g_z z̄=−2 log S",
        reason: "In complex dimension one, det(g_z z̄)=g_z z̄=S⁻².",
      },
      {
        id: "ricci-factor",
        before: "ρ=−i∂∂̄(−2 log S)",
        prompt: "Fire the final derivative. Which bundle carries twice the curvature?",
        choices: ["ρ=F_B/2", "ρ=F_B", "ρ=2F_B=2ω_FS"],
        correct: 2,
        after: "ρ=2ω_FS=2F_B",
        reason: "The factor 2 came from log(S⁻²), equivalently TCP¹≅O(2)—not from a fold.",
      },
    ],
  },
  {
    id: "chern",
    number: "03",
    kicker: "FIRST CHERN · INTEGRATE THE PATCH",
    title: "Turn densities into the integers 1 and 2",
    brief: "Compactify the complex chart by integrating to r=∞. The missing north pole has measure zero.",
    questions: [
      {
        id: "berry-polar",
        before: "F_B=2 dx∧dy/(1+r²)²",
        prompt: "After dx∧dy=r dr∧dθ, choose the complete radial integral.",
        choices: ["2π∫₀∞ r/(1+r²)² dr", "4π∫₀∞ r/(1+r²)² dr", "4π∫₀∞ 1/(1+r²)² dr"],
        correct: 1,
        after: "∫CP¹ F_B=4π∫₀∞ r/(1+r²)² dr",
        reason: "The density contributes 2 and the θ integral contributes 2π.",
      },
      {
        id: "radial-value",
        before: "I=∫₀∞ r/(1+r²)² dr",
        prompt: "Use u=1+r². Shoot the value of I.",
        choices: ["I=1", "I=π/2", "I=1/2"],
        correct: 2,
        after: "I=1/2  ⇒  ∫CP¹F_B=2π",
        reason: "du=2r dr and ∫₁∞u⁻²du=1.",
      },
      {
        id: "line-chern",
        before: "∫CP¹F_B=2π",
        prompt: "Normalize by 2π. What is the eigenline Chern number?",
        choices: ["c₁(L)=2", "c₁(L)=1", "c₁(L)=0"],
        correct: 1,
        after: "(1/2π)∫F_B=c₁(L)=1",
        reason: "The Berry lane covers one normalized curvature quantum.",
        charge: "berry",
      },
      {
        id: "tangent-chern",
        before: "ρ=2F_B",
        prompt: "Normalize the Ricci integral. What does TCP¹ carry?",
        choices: ["c₁(TCP¹)=1", "c₁(TCP¹)=2", "c₁(TCP¹)=4"],
        correct: 1,
        after: "(1/2π)∫ρ=c₁(TCP¹)=2",
        reason: "TCP¹≅O(2), so its first Chern number is twice the eigenline value.",
        charge: "ricci",
      },
    ],
  },
  {
    id: "pullback",
    number: "04",
    kicker: "PULLBACK · ENTER THE PAPER",
    title: "Carry the factor two from CP¹ back to the torus",
    brief: "Use the paper's concrete lower-band map at k=(π,0), then identify its signed Gauss formula.",
    questions: [
      {
        id: "torus-numerator",
        before: "k=(π,0):  cos kx+cos ky−cos kx cos ky",
        prompt: "Evaluate the numerator of λ̄.",
        choices: ["−1", "+1", "+3"],
        correct: 1,
        after: "−1+1−(−1)=+1",
        reason: "The orientation at this source sheet is positive.",
      },
      {
        id: "torus-density",
        before: "λ̄=(+1)/(2|d|³),  |d(π,0)|=1",
        prompt: "Shoot the actual Berry/signed-area density.",
        choices: ["λ̄=+1", "λ̄=+1/2", "λ̄=−1/2"],
        correct: 1,
        after: "Ω=λ̄=+1/2 at (π,0)",
        reason: "For this two-band map the paper identifies Berry curvature with signed area density.",
      },
      {
        id: "pullback-factor",
        before: "ρ=2ω_FS on CP¹",
        prompt: "Pull back both sides by f:T²→CP¹.",
        choices: ["f*ρ=2F_B", "f*ρ=F_B", "f*ρ=F_B²"],
        correct: 0,
        after: "f*ρ=2f*ω_FS=2F_B",
        reason: "Pullback preserves multiplication by 2; folds do not create this factor.",
      },
      {
        id: "paper-bridge",
        before: "paper: K_G=2,  dĀ=Ω dkx∧dky",
        prompt: "Which equality reveals Eq. (37) as the same factor-two relation?",
        choices: ["K_G dĀ=Ω=f*ρ", "K_G dĀ=2Ω=f*ρ", "K_G dĀ=Ω²=f*ρ"],
        correct: 1,
        after: "K_G dĀ=2Ω dkx∧dky=f*ρ",
        reason: "Thus (1/4π)∫K_GdĀ=(1/2π)∫Ω=C.",
      },
    ],
  },
  {
    id: "fold",
    number: "05",
    kicker: "FOLD STRESS TEST · TRY THE REGULARIZATION",
    title: "See exactly what g+εI repairs—and what it cannot",
    brief: "Use f(u,v)=(u,v²/2). The inverse can be forced for ε>0, but follow its limit and its missing sign.",
    questions: [
      {
        id: "fold-metric",
        before: "df=diag(1,v) for f(u,v)=(u,v²/2)",
        prompt: "Form the pullback metric g=(df)ᵀdf.",
        choices: ["g=diag(1,v)", "g=diag(1,v²)", "g=diag(1,|v|)"],
        correct: 1,
        after: "g(v)=diag(1,v²)",
        reason: "The metric squares the collapsed differential direction.",
      },
      {
        id: "fold-determinant",
        before: "g(v)=diag(1,v²)",
        prompt: "Where does the conventional inverse fail?",
        choices: ["det g=v", "det g=|v|", "det g=v²"],
        correct: 2,
        after: "det g=v²  ⇒  det g(0)=0",
        reason: "At v=0 the second tangent disappears and g⁻¹ is undefined.",
      },
      {
        id: "fold-sign",
        before: "√det g=|v|",
        prompt: "Which differentiable density remembers orientation across the fold?",
        choices: ["λ̄=v", "λ̄=|v|", "λ̄=v²"],
        correct: 0,
        after: "dĀ=v du∧dv, while dA=|v|du∧dv",
        reason: "The metric determinant remembers magnitude; the signed Jacobian also remembers which side.",
      },
      {
        id: "regularized-inverse",
        before: "g_ε(0)=g(0)+εI=diag(1+ε,ε)",
        prompt: "Invert the regularized metric at the fold.",
        choices: ["diag(1+ε,ε)", "diag((1+ε)⁻¹,ε⁻¹)", "diag(1,0)"],
        correct: 1,
        after: "g_ε(0)⁻¹=diag((1+ε)⁻¹,ε⁻¹)",
        reason: "Regularization supplies an inverse for every fixed ε>0.",
      },
      {
        id: "regularization-limit",
        before: "g_ε(0)⁻¹ second entry =1/ε",
        prompt: "Now send ε→0. What is the decisive outcome?",
        choices: ["It converges to 0", "It converges to a finite inverse", "It diverges; no inverse is recovered"],
        correct: 2,
        after: "ε→0: 1/ε→∞  ·  no finite g⁻¹ at the fold",
        reason: "The regularized family is calculable, but its inverse does not converge to an inverse of the singular metric.",
      },
      {
        id: "final-verdict",
        before: "g_ε gives |density|>0 at v=0;  dĀ=v du∧dv crosses through 0",
        prompt: "Which statement preserves the paper's actual geometric information?",
        choices: [
          "Regularization restores the missing orientation automatically",
          "The signed form stays smooth and keeps the sign; regularized inverse is a different limit problem",
          "The fold makes both Berry and Ricci curvature undefined",
        ],
        correct: 1,
        after: "SIGNED FORM SURVIVES · INVERSE METRIC DOES NOT",
        reason: "This is why the regularization question remains useful, but cannot replace the front/signed-form analysis by itself.",
      },
    ],
  },
]);

export const CURVATURE_QUESTIONS = Object.freeze(
  CURVATURE_MISSIONS.flatMap((mission, missionIndex) => (
    mission.questions.map((question, questionIndex) => Object.freeze({
      ...question,
      missionId: mission.id,
      missionIndex,
      questionIndex,
    }))
  )),
);

export function createCurvatureState() {
  return {
    status: "ready",
    missionIndex: 0,
    questionIndex: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    integrity: 100,
    correctAnswers: 0,
    wrongAnswers: 0,
    berryCharge: 0,
    ricciCharge: 0,
    receipt: [],
    lastEvent: null,
  };
}

export function currentMission(state) {
  return CURVATURE_MISSIONS[state.missionIndex] ?? null;
}

export function currentCurvatureQuestion(state) {
  return currentMission(state)?.questions[state.questionIndex] ?? null;
}

function chargeLane(state, lane) {
  if (lane === "berry") return { ...state, berryCharge: state.berryCharge + 1 };
  if (lane === "ricci") return { ...state, ricciCharge: state.ricciCharge + 2 };
  return state;
}

export function startCurvatureRun(state = createCurvatureState()) {
  return { ...state, status: "active", lastEvent: { type: "start" } };
}

export function answerCurvatureQuestion(state, choiceIndex) {
  if (state.status !== "active") return state;
  const question = currentCurvatureQuestion(state);
  if (!question) return state;

  if (choiceIndex !== question.correct) {
    return {
      ...state,
      combo: 0,
      integrity: Math.max(10, state.integrity - 18),
      wrongAnswers: state.wrongAnswers + 1,
      lastEvent: {
        type: "wrong",
        questionId: question.id,
        choiceIndex,
        expected: question.correct,
      },
    };
  }

  const combo = state.combo + 1;
  let next = chargeLane({
    ...state,
    score: state.score + 100 + combo * 25,
    combo,
    bestCombo: Math.max(state.bestCombo, combo),
    integrity: Math.min(100, state.integrity + 6),
    correctAnswers: state.correctAnswers + 1,
    receipt: [...state.receipt, {
      questionId: question.id,
      before: question.before,
      after: question.after,
      reason: question.reason,
    }],
    lastEvent: {
      type: "correct",
      questionId: question.id,
      choiceIndex,
      after: question.after,
    },
  }, question.charge);

  const mission = currentMission(next);
  const lastQuestion = next.questionIndex === mission.questions.length - 1;
  if (!lastQuestion) return { ...next, questionIndex: next.questionIndex + 1 };
  if (next.missionIndex === CURVATURE_MISSIONS.length - 1) {
    return { ...next, status: "complete" };
  }
  return { ...next, status: "mission-clear" };
}

export function advanceCurvatureMission(state) {
  if (state.status !== "mission-clear") return state;
  return {
    ...state,
    status: "active",
    missionIndex: state.missionIndex + 1,
    questionIndex: 0,
    lastEvent: { type: "mission-start", missionIndex: state.missionIndex + 1 },
  };
}

export function replayCurvatureRun(choiceIndexes) {
  let state = startCurvatureRun();
  for (const choiceIndex of choiceIndexes) {
    state = answerCurvatureQuestion(state, choiceIndex);
    if (state.status === "mission-clear") state = advanceCurvatureMission(state);
  }
  return state;
}

export function perfectCurvatureChoices() {
  return CURVATURE_QUESTIONS.map((question) => question.correct);
}
