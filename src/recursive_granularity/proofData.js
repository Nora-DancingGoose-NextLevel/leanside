// src/recursive_granularity/proofData.js
// Static data for the /recursive_granularity prototype (EECS127 midterm Q11).
//
// The Lean proof below compiles against the repo's Mathlib (lean4 v4.23.0); the
// only `sorry`s are the two axioms listed in AXIOMS_USED, which are copied from
// LeanTutor127/midterm_11.lean.
//
// Tree node shape:
//   id       unique id
//   level    granularity tier: 0 theorem, 1 part, 2 semantic group, 3 lemma,
//            4 top-level have, 5+ nested have
//   kind     "theorem" | "part" | "group" | "lemma" | "tactic"
//   steps    NL solution step numbers this node covers
//   informal one-sentence informalization (LaTeX in \( \) / \[ \])
//   header   (optional) Lean lines owned by this node, shown above its children
//   code     (leaf only) Lean lines for this node
//   children (optional) finer-grained nodes
//
// The full Lean for any node is header + children joined (see fullLean), so
// every granularity shows exactly the same proof, just chunked differently.

const t = String.raw;

export const PROBLEM = {
  title: "EECS 127 Midterm, Problem 11",
  statement: t`Let \(A \in \mathbb{R}^{n \times n}\) (\(n \ge 2\)) be symmetric with eigenvalues \(\lambda_0 > \lambda_1 > \cdots > \lambda_{n-1}\) and corresponding orthonormal eigenvectors \(\tilde{v}_0, \ldots, \tilde{v}_{n-1}\). Consider
\[p^\star = \max_{x \in \mathbb{R}^n} \; x^T A x \quad \text{s.t.} \quad \|x\|_2 = 1,\;\; x^T \tilde{v}_0 = 0.\]
Show that \(p^\star = \lambda_1\).`,
};

// Student-style natural-language solution (moderate level of detail).
export const NL_SOLUTION = [
  { step: 1, section: "Goal", text: t`We show \(p^\star = \lambda_1\) by proving \(p^\star \ge \lambda_1\) (achievability) and \(p^\star \le \lambda_1\) (optimality).` },
  { step: 2, section: t`Part (a): \(p^\star \ge \lambda_1\)`, text: t`Choose \(x = \tilde{v}_1\). Since the eigenvectors are orthonormal, \(\|x\|_2^2 = \tilde{v}_1^T \tilde{v}_1 = 1\).` },
  { step: 3, text: t`Also \(x^T \tilde{v}_0 = \tilde{v}_1^T \tilde{v}_0 = 0\), because \(\tilde{v}_1\) and \(\tilde{v}_0\) are distinct orthonormal vectors. So \(x = \tilde{v}_1\) is feasible.` },
  { step: 4, text: t`Its objective value is \(\tilde{v}_1^T A \tilde{v}_1 = \tilde{v}_1^T (\lambda_1 \tilde{v}_1) = \lambda_1 \tilde{v}_1^T \tilde{v}_1 = \lambda_1\).` },
  { step: 5, text: t`Since a feasible point attains \(\lambda_1\), \(p^\star \ge \lambda_1\).` },
  { step: 6, section: t`Part (b): \(p^\star \le \lambda_1\)`, text: t`Let \(x\) be any feasible point. Since \(A\) is symmetric, \(A = V \Lambda V^T\) with \(V = [\tilde{v}_0 \cdots \tilde{v}_{n-1}]\) orthogonal. Let \(y = V^T x\), so \(y_i = \tilde{v}_i^T x\).` },
  { step: 7, text: t`Then \(x^T A x = x^T V \Lambda V^T x = y^T \Lambda y = \sum_{i=0}^{n-1} \lambda_i y_i^2\).` },
  { step: 8, text: t`The constraint \(x^T \tilde{v}_0 = 0\) gives \(y_0 = \tilde{v}_0^T x = 0\).` },
  { step: 9, text: t`Since \(V\) is orthogonal, \(\sum_{i=0}^{n-1} y_i^2 = \|V^T x\|_2^2 = \|x\|_2^2 = 1\).` },
  { step: 10, text: t`The \(i = 0\) term vanishes, and for \(i \ge 1\) we have \(\lambda_i \le \lambda_1\) and \(y_i^2 \ge 0\). Hence \(\sum_{i} \lambda_i y_i^2 \le \lambda_1 \sum_{i} y_i^2\).` },
  { step: 11, text: t`Therefore \(x^T A x \le \lambda_1 \cdot 1 = \lambda_1\) for every feasible \(x\), so \(p^\star \le \lambda_1\).` },
  { step: 12, section: "Conclusion", text: t`Combining both parts, \(p^\star = \lambda_1\), attained at \(x = \tilde{v}_1\).` },
];

export const AXIOMS_USED = [
  { name: "spectral_quadratic_form", informal: t`\(x^T A x = \sum_{i=0}^{n-1} \lambda_i (\tilde{v}_i^T x)^2\) for an orthonormal eigenbasis` },
  { name: "parseval_identity", informal: t`\(\sum_{i=0}^{n-1} (\tilde{v}_i^T x)^2 = x^T x\) for an orthonormal basis` },
];

export const GRANULARITY_LABELS = [
  "Theorem",
  "Proof parts",
  "Semantic groups",
  "Lemmas",
  "Have statements",
  "Nested haves",
  "Nested haves (2)",
  "Nested haves (3)",
  "Nested haves (4)",
];

export const DEFAULT_GRANULARITY = 2;

// ───────────────────────── Part (a) ─────────────────────────

const step2 = {
  id: "step_2", level: 3, kind: "lemma", steps: [2],
  informal: t`\(\tilde{v}_1^T \tilde{v}_1 = 1\).`,
  header: `-- STEP 2: x = ṽ₁ has unit norm
lemma step_2_v1_unit_norm {n : ℕ} {eigvecs : Fin n → (Fin n → ℝ)}
  (h_orthonormal : ∀ i j : Fin n, (eigvecs i) ⬝ᵥ (eigvecs j) = if i = j then 1 else 0)
  (hn : 2 ≤ n) :
  (eigvecs ⟨1, by omega⟩) ⬝ᵥ (eigvecs ⟨1, by omega⟩) = 1 := by`,
  children: [
    {
      id: "step_2.h_diag", level: 4, kind: "tactic", steps: [2],
      informal: t`By orthonormality, \(\tilde{v}_1^T \tilde{v}_1 = 1\) if \(1 = 1\), and \(0\) otherwise.`,
      code: `  have h_diag := h_orthonormal ⟨1, by omega⟩ ⟨1, by omega⟩`,
    },
    {
      id: "step_2.close", level: 4, kind: "tactic", steps: [2],
      informal: t`Since \(1 = 1\), this gives \(\tilde{v}_1^T \tilde{v}_1 = 1\).`,
      code: `  rw [if_pos rfl] at h_diag
  exact h_diag`,
    },
  ],
};

const step3 = {
  id: "step_3", level: 3, kind: "lemma", steps: [3],
  informal: t`\(\tilde{v}_1^T \tilde{v}_0 = 0\).`,
  header: `-- STEP 3: ṽ₁ is orthogonal to ṽ₀
lemma step_3_v1_orth_v0 {n : ℕ} {eigvecs : Fin n → (Fin n → ℝ)}
  (h_orthonormal : ∀ i j : Fin n, (eigvecs i) ⬝ᵥ (eigvecs j) = if i = j then 1 else 0)
  (hn : 2 ≤ n) :
  (eigvecs ⟨1, by omega⟩) ⬝ᵥ (eigvecs ⟨0, by omega⟩) = 0 := by`,
  children: [
    {
      id: "step_3.h_ne", level: 4, kind: "tactic", steps: [3],
      informal: t`The indices are distinct: \(1 \neq 0\).`,
      header: `  have h_ne : (⟨1, by omega⟩ : Fin n) ≠ ⟨0, by omega⟩ := by`,
      children: [
        {
          id: "step_3.h_ne.h_val", level: 5, kind: "tactic", steps: [3],
          informal: t`If the indices were equal, then \(1 = 0\) as natural numbers.`,
          code: `    intro h
    have h_val : (1 : ℕ) = 0 := congrArg Fin.val h`,
        },
        {
          id: "step_3.h_ne.omega", level: 5, kind: "tactic", steps: [3],
          informal: t`\(1 = 0\) is false, which is a contradiction.`,
          code: `    omega`,
        },
      ],
    },
    {
      id: "step_3.h_off", level: 4, kind: "tactic", steps: [3],
      informal: t`By orthonormality, \(\tilde{v}_1^T \tilde{v}_0 = 1\) if \(1 = 0\), and \(0\) otherwise.`,
      code: `  have h_off := h_orthonormal ⟨1, by omega⟩ ⟨0, by omega⟩`,
    },
    {
      id: "step_3.close", level: 4, kind: "tactic", steps: [3],
      informal: t`Since \(1 \neq 0\), \(\tilde{v}_1^T \tilde{v}_0 = 0\).`,
      code: `  rw [if_neg h_ne] at h_off
  exact h_off`,
    },
  ],
};

const step4 = {
  id: "step_4", level: 3, kind: "lemma", steps: [4],
  informal: t`\(\tilde{v}_1^T A \tilde{v}_1 = \lambda_1\).`,
  header: `-- STEP 4: ṽ₁ᵀAṽ₁ = λ₁
lemma step_4_v1_attains_lambda1 {n : ℕ} {A : Matrix (Fin n) (Fin n) ℝ}
  {eigvecs : Fin n → (Fin n → ℝ)} {eigvals : Fin n → ℝ}
  (h_eigen : ∀ i : Fin n, A *ᵥ (eigvecs i) = (eigvals i) • (eigvecs i))
  (h_orthonormal : ∀ i j : Fin n, (eigvecs i) ⬝ᵥ (eigvecs j) = if i = j then 1 else 0)
  (hn : 2 ≤ n) :
  (eigvecs ⟨1, by omega⟩) ⬝ᵥ (A *ᵥ (eigvecs ⟨1, by omega⟩)) = eigvals ⟨1, by omega⟩ := by`,
  children: [
    {
      id: "step_4.h_Av1", level: 4, kind: "tactic", steps: [4],
      informal: t`\(A \tilde{v}_1 = \lambda_1 \tilde{v}_1\).`,
      code: `  have h_Av1 : A *ᵥ (eigvecs ⟨1, by omega⟩) = (eigvals ⟨1, by omega⟩) • (eigvecs ⟨1, by omega⟩) :=
    h_eigen ⟨1, by omega⟩`,
    },
    {
      id: "step_4.h_pull", level: 4, kind: "tactic", steps: [4],
      informal: t`\(\tilde{v}_1^T (\lambda_1 \tilde{v}_1) = \lambda_1 (\tilde{v}_1^T \tilde{v}_1)\).`,
      code: `  have h_pull : (eigvecs ⟨1, by omega⟩) ⬝ᵥ ((eigvals ⟨1, by omega⟩) • (eigvecs ⟨1, by omega⟩))
      = (eigvals ⟨1, by omega⟩) * ((eigvecs ⟨1, by omega⟩) ⬝ᵥ (eigvecs ⟨1, by omega⟩)) := by
    rw [dotProduct_smul, smul_eq_mul]`,
    },
    {
      id: "step_4.h_unit", level: 4, kind: "tactic", steps: [4],
      informal: t`\(\tilde{v}_1^T \tilde{v}_1 = 1\).`,
      code: `  have h_unit := step_2_v1_unit_norm h_orthonormal hn`,
    },
    {
      id: "step_4.close", level: 4, kind: "tactic", steps: [4],
      informal: t`\(\tilde{v}_1^T A \tilde{v}_1 = \lambda_1 (\tilde{v}_1^T \tilde{v}_1) = \lambda_1 \cdot 1 = \lambda_1\).`,
      code: `  rw [h_Av1, h_pull, h_unit, mul_one]`,
    },
  ],
};

const partALemma = {
  id: "part_a_lemma", level: 3, kind: "lemma", steps: [5],
  informal: t`There exists \(x\) (namely \(\tilde{v}_1\)) with \(x^T x = 1\), \(x^T \tilde{v}_0 = 0\), and \(x^T A x = \lambda_1\).`,
  header: `-- STEP 5: p* ≥ λ₁ (x = ṽ₁ is feasible and attains λ₁)
lemma part_a_achievability {n : ℕ} {A : Matrix (Fin n) (Fin n) ℝ}
  {eigvecs : Fin n → (Fin n → ℝ)} {eigvals : Fin n → ℝ}
  (h_eigen : ∀ i : Fin n, A *ᵥ (eigvecs i) = (eigvals i) • (eigvecs i))
  (h_orthonormal : ∀ i j : Fin n, (eigvecs i) ⬝ᵥ (eigvecs j) = if i = j then 1 else 0)
  (hn : 2 ≤ n) :
  ∃ x : Fin n → ℝ,
    x ⬝ᵥ x = 1 ∧
    x ⬝ᵥ (eigvecs ⟨0, by omega⟩) = 0 ∧
    x ⬝ᵥ (A *ᵥ x) = eigvals ⟨1, by omega⟩ := by`,
  children: [
    {
      id: "part_a.refine", level: 4, kind: "tactic", steps: [5],
      informal: t`Take \(x = \tilde{v}_1\); it remains to check the three conditions.`,
      code: `  refine ⟨eigvecs ⟨1, by omega⟩, ?_, ?_, ?_⟩`,
    },
    {
      id: "part_a.norm", level: 4, kind: "tactic", steps: [2, 5],
      informal: t`\(x^T x = \tilde{v}_1^T \tilde{v}_1 = 1\).`,
      code: `  · exact step_2_v1_unit_norm h_orthonormal hn`,
    },
    {
      id: "part_a.orth", level: 4, kind: "tactic", steps: [3, 5],
      informal: t`\(x^T \tilde{v}_0 = \tilde{v}_1^T \tilde{v}_0 = 0\).`,
      code: `  · exact step_3_v1_orth_v0 h_orthonormal hn`,
    },
    {
      id: "part_a.value", level: 4, kind: "tactic", steps: [4, 5],
      informal: t`\(x^T A x = \tilde{v}_1^T A \tilde{v}_1 = \lambda_1\).`,
      code: `  · exact step_4_v1_attains_lambda1 h_eigen h_orthonormal hn`,
    },
  ],
};

const partA = {
  id: "part_a", level: 1, kind: "part", steps: [2, 3, 4, 5],
  informal: t`Achievability: some \(x\) with \(x^T x = 1\) and \(x^T \tilde{v}_0 = 0\) has \(x^T A x = \lambda_1\), so \(p^\star \ge \lambda_1\).`,
  children: [
    {
      id: "group_feasible", level: 2, kind: "group", steps: [2, 3],
      informal: t`\(x = \tilde{v}_1\) is feasible: \(\tilde{v}_1^T \tilde{v}_1 = 1\) and \(\tilde{v}_1^T \tilde{v}_0 = 0\).`,
      children: [step2, step3],
    },
    {
      id: "group_attains", level: 2, kind: "group", steps: [4, 5],
      informal: t`\(\tilde{v}_1^T A \tilde{v}_1 = \lambda_1\), so the feasible point \(\tilde{v}_1\) attains \(\lambda_1\).`,
      children: [step4, partALemma],
    },
  ],
};

// ───────────────────────── Part (b) ─────────────────────────

const step7 = {
  id: "step_7", level: 2, kind: "lemma", steps: [6, 7],
  informal: t`For every \(x\), \(x^T A x = \sum_{i=0}^{n-1} \lambda_i (\tilde{v}_i^T x)^2\), i.e. \(\sum_i \lambda_i y_i^2\) with \(y_i = \tilde{v}_i^T x\).`,
  code: `-- STEPS 6–7: with y = Vᵀx (yᵢ = ṽᵢᵀx), xᵀAx = Σᵢ λᵢ yᵢ²
lemma step_7_quad_form_in_y {n : ℕ} {A : Matrix (Fin n) (Fin n) ℝ}
  {eigvecs : Fin n → (Fin n → ℝ)} {eigvals : Fin n → ℝ}
  (h_eigen : ∀ i : Fin n, A *ᵥ (eigvecs i) = (eigvals i) • (eigvecs i))
  (h_orthonormal : ∀ i j : Fin n, (eigvecs i) ⬝ᵥ (eigvecs j) = if i = j then 1 else 0)
  (x : Fin n → ℝ) :
  x ⬝ᵥ (A *ᵥ x) = ∑ i : Fin n, (eigvals i) * ((eigvecs i) ⬝ᵥ x) ^ 2 := by
  exact spectral_quadratic_form h_eigen h_orthonormal x`,
};

const step8 = {
  id: "step_8", level: 3, kind: "lemma", steps: [8],
  informal: t`\(x^T \tilde{v}_0 = 0\) implies \(\tilde{v}_0^T x = 0\).`,
  header: `-- STEP 8: y₀ = ṽ₀ᵀx = 0
lemma step_8_y0_eq_zero {n : ℕ} {eigvecs : Fin n → (Fin n → ℝ)}
  (hn : 2 ≤ n) (x : Fin n → ℝ)
  (hx_orth : x ⬝ᵥ (eigvecs ⟨0, by omega⟩) = 0) :
  (eigvecs ⟨0, by omega⟩) ⬝ᵥ x = 0 := by`,
  children: [
    {
      id: "step_8.h_comm", level: 4, kind: "tactic", steps: [8],
      informal: t`\(\tilde{v}_0^T x = x^T \tilde{v}_0\).`,
      code: `  have h_comm : (eigvecs ⟨0, by omega⟩) ⬝ᵥ x = x ⬝ᵥ (eigvecs ⟨0, by omega⟩) :=
    dotProduct_comm _ _`,
    },
    {
      id: "step_8.close", level: 4, kind: "tactic", steps: [8],
      informal: t`Substituting \(x^T \tilde{v}_0 = 0\) gives \(\tilde{v}_0^T x = 0\).`,
      code: `  rw [h_comm]
  exact hx_orth`,
    },
  ],
};

const step9 = {
  id: "step_9", level: 3, kind: "lemma", steps: [9],
  informal: t`\(x^T x = 1\) implies \(\sum_{i=0}^{n-1} (\tilde{v}_i^T x)^2 = 1\).`,
  header: `-- STEP 9: Σᵢ yᵢ² = ‖x‖² = 1
lemma step_9_sum_y_sq_eq_one {n : ℕ} {eigvecs : Fin n → (Fin n → ℝ)}
  (h_orthonormal : ∀ i j : Fin n, (eigvecs i) ⬝ᵥ (eigvecs j) = if i = j then 1 else 0)
  (x : Fin n → ℝ) (hx_norm : x ⬝ᵥ x = 1) :
  ∑ i : Fin n, ((eigvecs i) ⬝ᵥ x) ^ 2 = 1 := by`,
  children: [
    {
      id: "step_9.h_parseval", level: 4, kind: "tactic", steps: [9],
      informal: t`\(\sum_{i=0}^{n-1} (\tilde{v}_i^T x)^2 = x^T x\).`,
      code: `  have h_parseval := parseval_identity h_orthonormal x`,
    },
    {
      id: "step_9.close", level: 4, kind: "tactic", steps: [9],
      informal: t`Since \(x^T x = 1\), \(\sum_{i=0}^{n-1} (\tilde{v}_i^T x)^2 = 1\).`,
      code: `  rw [h_parseval]
  exact hx_norm`,
    },
  ],
};

const hTerm = {
  id: "step_10.h_term", level: 4, kind: "tactic", steps: [10],
  informal: t`\(\lambda_i (\tilde{v}_i^T x)^2 \le \lambda_1 (\tilde{v}_i^T x)^2\) for every \(i\).`,
  header: `  have h_term : ∀ i : Fin n,
      (eigvals i) * ((eigvecs i) ⬝ᵥ x) ^ 2 ≤ (eigvals ⟨1, by omega⟩) * ((eigvecs i) ⬝ᵥ x) ^ 2 := by`,
  children: [
    {
      id: "step_10.h_term.split", level: 5, kind: "tactic", steps: [10],
      informal: t`Fix \(i\) and consider the cases \(i = 0\) and \(i \neq 0\).`,
      code: `    intro i
    by_cases hi0 : i.val = 0`,
    },
    {
      id: "step_10.h_term.case0", level: 5, kind: "tactic", steps: [10],
      informal: t`If \(i = 0\), both sides are \(0\) because \(\tilde{v}_0^T x = 0\).`,
      children: [
        {
          id: "step_10.h_term.case0.h_i", level: 6, kind: "tactic", steps: [10],
          informal: t`\(i = 0\).`,
          code: `    · have h_i : i = ⟨0, by omega⟩ := Fin.ext hi0`,
        },
        {
          id: "step_10.h_term.case0.close", level: 6, kind: "tactic", steps: [10],
          informal: t`Substituting \(\tilde{v}_0^T x = 0\): \(\lambda_0 \cdot 0^2 \le \lambda_1 \cdot 0^2\).`,
          code: `      rw [h_i, h_y0]
      simp`,
        },
      ],
    },
    {
      id: "step_10.h_term.caseNe0", level: 5, kind: "tactic", steps: [10],
      informal: t`If \(i \neq 0\), then \(\lambda_i \le \lambda_1\) and \((\tilde{v}_i^T x)^2 \ge 0\), so \(\lambda_i (\tilde{v}_i^T x)^2 \le \lambda_1 (\tilde{v}_i^T x)^2\).`,
      children: [
        {
          id: "step_10.h_term.caseNe0.h_le", level: 6, kind: "tactic", steps: [10],
          informal: t`\(\lambda_i \le \lambda_1\).`,
          header: `    · have h_le : eigvals i ≤ eigvals ⟨1, by omega⟩ := by`,
          children: [
            {
              id: "step_10.h_le.case1", level: 7, kind: "tactic", steps: [10],
              informal: t`If \(i = 1\), then \(\lambda_i = \lambda_1\).`,
              code: `        by_cases hi1 : i.val = 1
        · have h_i : i = ⟨1, by omega⟩ := Fin.ext hi1
          rw [h_i]`,
            },
            {
              id: "step_10.h_le.caseGe2", level: 7, kind: "tactic", steps: [10],
              informal: t`If \(i \ge 2\), then \(1 < i\), so \(\lambda_1 > \lambda_i\) by the ordering of the eigenvalues.`,
              children: [
                {
                  id: "step_10.h_le.caseGe2.h_lt", level: 8, kind: "tactic", steps: [10],
                  informal: t`\(1 < i\), since \(i \neq 0\) and \(i \neq 1\).`,
                  code: `        · have h_lt : (⟨1, by omega⟩ : Fin n).val < i.val := by
            show 1 < i.val
            omega`,
                },
                {
                  id: "step_10.h_le.caseGe2.exact", level: 8, kind: "tactic", steps: [10],
                  informal: t`\(1 < i\) implies \(\lambda_1 > \lambda_i\), hence \(\lambda_i \le \lambda_1\).`,
                  code: `          exact le_of_lt (h_ordered ⟨1, by omega⟩ i h_lt)`,
                },
              ],
            },
          ],
        },
        {
          id: "step_10.h_term.caseNe0.h_sq", level: 6, kind: "tactic", steps: [10],
          informal: t`\((\tilde{v}_i^T x)^2 \ge 0\).`,
          code: `      have h_sq : 0 ≤ ((eigvecs i) ⬝ᵥ x) ^ 2 := sq_nonneg _`,
        },
        {
          id: "step_10.h_term.caseNe0.close", level: 6, kind: "tactic", steps: [10],
          informal: t`Multiplying \(\lambda_i \le \lambda_1\) by \((\tilde{v}_i^T x)^2 \ge 0\) gives \(\lambda_i (\tilde{v}_i^T x)^2 \le \lambda_1 (\tilde{v}_i^T x)^2\).`,
          code: `      exact mul_le_mul_of_nonneg_right h_le h_sq`,
        },
      ],
    },
  ],
};

const step10 = {
  id: "step_10", level: 3, kind: "lemma", steps: [10],
  informal: t`\(x^T \tilde{v}_0 = 0\) implies \(\sum_{i=0}^{n-1} \lambda_i (\tilde{v}_i^T x)^2 \le \lambda_1 \sum_{i=0}^{n-1} (\tilde{v}_i^T x)^2\).`,
  header: `-- STEP 10: Σᵢ λᵢ yᵢ² ≤ λ₁ Σᵢ yᵢ²
lemma step_10_weighted_sum_bound {n : ℕ} {eigvecs : Fin n → (Fin n → ℝ)} {eigvals : Fin n → ℝ}
  (h_ordered : ∀ i j : Fin n, i.val < j.val → eigvals i > eigvals j)
  (hn : 2 ≤ n) (x : Fin n → ℝ)
  (hx_orth : x ⬝ᵥ (eigvecs ⟨0, by omega⟩) = 0) :
  ∑ i : Fin n, (eigvals i) * ((eigvecs i) ⬝ᵥ x) ^ 2 ≤
    (eigvals ⟨1, by omega⟩) * ∑ i : Fin n, ((eigvecs i) ⬝ᵥ x) ^ 2 := by`,
  children: [
    {
      id: "step_10.h_y0", level: 4, kind: "tactic", steps: [8, 10],
      informal: t`\(\tilde{v}_0^T x = 0\).`,
      code: `  have h_y0 := step_8_y0_eq_zero hn x hx_orth`,
    },
    hTerm,
    {
      id: "step_10.h_sum_le", level: 4, kind: "tactic", steps: [10],
      informal: t`\(\sum_{i=0}^{n-1} \lambda_i (\tilde{v}_i^T x)^2 \le \sum_{i=0}^{n-1} \lambda_1 (\tilde{v}_i^T x)^2\).`,
      code: `  have h_sum_le := Finset.sum_le_sum (fun i (_ : i ∈ Finset.univ) => h_term i)`,
    },
    {
      id: "step_10.close", level: 4, kind: "tactic", steps: [10],
      informal: t`Factoring out \(\lambda_1\) gives \(\sum_{i} \lambda_i (\tilde{v}_i^T x)^2 \le \lambda_1 \sum_{i} (\tilde{v}_i^T x)^2\).`,
      code: `  rw [← Finset.mul_sum] at h_sum_le
  exact h_sum_le`,
    },
  ],
};

const partBLemma = {
  id: "part_b_lemma", level: 3, kind: "lemma", steps: [11],
  informal: t`For every \(x\), \(x^T x = 1\) and \(x^T \tilde{v}_0 = 0\) imply \(x^T A x \le \lambda_1\).`,
  header: `-- STEP 11: xᵀAx ≤ λ₁ for every feasible x, so p* ≤ λ₁
lemma part_b_optimality {n : ℕ} {A : Matrix (Fin n) (Fin n) ℝ}
  {eigvecs : Fin n → (Fin n → ℝ)} {eigvals : Fin n → ℝ}
  (h_eigen : ∀ i : Fin n, A *ᵥ (eigvecs i) = (eigvals i) • (eigvecs i))
  (h_orthonormal : ∀ i j : Fin n, (eigvecs i) ⬝ᵥ (eigvecs j) = if i = j then 1 else 0)
  (h_ordered : ∀ i j : Fin n, i.val < j.val → eigvals i > eigvals j)
  (hn : 2 ≤ n) :
  ∀ x : Fin n → ℝ,
    x ⬝ᵥ x = 1 →
    x ⬝ᵥ (eigvecs ⟨0, by omega⟩) = 0 →
    x ⬝ᵥ (A *ᵥ x) ≤ eigvals ⟨1, by omega⟩ := by`,
  children: [
    {
      id: "part_b.intro", level: 4, kind: "tactic", steps: [6, 11],
      informal: t`Let \(x\) satisfy \(x^T x = 1\) and \(x^T \tilde{v}_0 = 0\).`,
      code: `  intro x hx_norm hx_orth`,
    },
    {
      id: "part_b.h_quad", level: 4, kind: "tactic", steps: [7, 11],
      informal: t`\(x^T A x = \sum_{i=0}^{n-1} \lambda_i (\tilde{v}_i^T x)^2\).`,
      code: `  have h_quad := step_7_quad_form_in_y h_eigen h_orthonormal x`,
    },
    {
      id: "part_b.h_bound", level: 4, kind: "tactic", steps: [10, 11],
      informal: t`\(\sum_{i=0}^{n-1} \lambda_i (\tilde{v}_i^T x)^2 \le \lambda_1 \sum_{i=0}^{n-1} (\tilde{v}_i^T x)^2\).`,
      code: `  have h_bound := step_10_weighted_sum_bound h_ordered hn x hx_orth`,
    },
    {
      id: "part_b.h_sum_one", level: 4, kind: "tactic", steps: [9, 11],
      informal: t`\(\sum_{i=0}^{n-1} (\tilde{v}_i^T x)^2 = 1\).`,
      code: `  have h_sum_one := step_9_sum_y_sq_eq_one h_orthonormal x hx_norm`,
    },
    {
      id: "part_b.close", level: 4, kind: "tactic", steps: [11],
      informal: t`Therefore \(x^T A x = \sum_{i} \lambda_i (\tilde{v}_i^T x)^2 \le \lambda_1 \cdot 1 = \lambda_1\).`,
      code: `  rw [h_sum_one, mul_one] at h_bound
  rw [h_quad]
  exact h_bound`,
    },
  ],
};

const partB = {
  id: "part_b", level: 1, kind: "part", steps: [6, 7, 8, 9, 10, 11],
  informal: t`Optimality: every \(x\) with \(x^T x = 1\) and \(x^T \tilde{v}_0 = 0\) has \(x^T A x \le \lambda_1\), so \(p^\star \le \lambda_1\).`,
  children: [
    step7,
    {
      id: "group_constraints", level: 2, kind: "group", steps: [8, 9],
      informal: t`The constraints become \(y_0 = \tilde{v}_0^T x = 0\) and \(\sum_{i=0}^{n-1} y_i^2 = 1\).`,
      children: [step8, step9],
    },
    {
      id: "group_bound", level: 2, kind: "group", steps: [10, 11],
      informal: t`\(\sum_{i} \lambda_i y_i^2 \le \lambda_1 \sum_{i} y_i^2 = \lambda_1\), so \(x^T A x \le \lambda_1\) for every feasible \(x\).`,
      children: [step10, partBLemma],
    },
  ],
};

// ───────────────────────── Main theorem ─────────────────────────

const mainTheorem = {
  id: "main_theorem", level: 1, kind: "lemma", steps: [1, 12],
  informal: t`Both parts hold, so \(p^\star = \lambda_1\).`,
  header: `-- STEP 12: p* = λ₁
theorem second_principal_component {n : ℕ}
  {A : Matrix (Fin n) (Fin n) ℝ}
  {eigvecs : Fin n → (Fin n → ℝ)}
  {eigvals : Fin n → ℝ}
  (hA : A.IsHermitian)
  (h_eigen : ∀ i : Fin n, A *ᵥ (eigvecs i) = (eigvals i) • (eigvecs i))
  (h_orthonormal : ∀ i j : Fin n, (eigvecs i) ⬝ᵥ (eigvecs j) = if i = j then 1 else 0)
  (h_ordered : ∀ i j : Fin n, i.val < j.val → eigvals i > eigvals j)
  (hn : 2 ≤ n) :
  (∃ x : Fin n → ℝ,
    x ⬝ᵥ x = 1 ∧
    x ⬝ᵥ (eigvecs ⟨0, by omega⟩) = 0 ∧
    x ⬝ᵥ (A *ᵥ x) = eigvals ⟨1, by omega⟩) ∧
  (∀ x : Fin n → ℝ,
    x ⬝ᵥ x = 1 →
    x ⬝ᵥ (eigvecs ⟨0, by omega⟩) = 0 →
    x ⬝ᵥ (A *ᵥ x) ≤ eigvals ⟨1, by omega⟩) := by`,
  children: [
    {
      id: "main.h_part_a", level: 4, kind: "tactic", steps: [5, 12],
      informal: t`Some \(x\) with \(x^T x = 1\) and \(x^T \tilde{v}_0 = 0\) has \(x^T A x = \lambda_1\).`,
      code: `  have h_part_a := part_a_achievability h_eigen h_orthonormal hn`,
    },
    {
      id: "main.h_part_b", level: 4, kind: "tactic", steps: [11, 12],
      informal: t`Every \(x\) with \(x^T x = 1\) and \(x^T \tilde{v}_0 = 0\) has \(x^T A x \le \lambda_1\).`,
      code: `  have h_part_b := part_b_optimality h_eigen h_orthonormal h_ordered hn`,
    },
    {
      id: "main.exact", level: 4, kind: "tactic", steps: [12],
      informal: t`Combining the two parts proves the theorem.`,
      code: `  exact ⟨h_part_a, h_part_b⟩`,
    },
  ],
};

export const PROOF_TREE = {
  id: "root", level: 0, kind: "theorem", steps: NL_SOLUTION.map((s) => s.step),
  informal: t`\(p^\star = \lambda_1\): some \(x\) with \(\|x\|_2 = 1\), \(x^T \tilde{v}_0 = 0\) attains \(x^T A x = \lambda_1\), and every such \(x\) has \(x^T A x \le \lambda_1\).`,
  children: [partA, partB, mainTheorem],
};

// File-level containers separate their lemmas with a blank line.
const FILE_LEVEL_KINDS = new Set(["theorem", "part", "group"]);

export function fullLean(node) {
  if (!node.children) return node.code;
  const sep = FILE_LEVEL_KINDS.has(node.kind) ? "\n\n" : "\n";
  const parts = node.children.map(fullLean);
  return node.header ? [node.header, ...parts].join("\n") : parts.join(sep);
}
