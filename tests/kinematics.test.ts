import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { COURSE_PRESETS, evaluatePresetDiscrepancy, forwardKinematics, geometricJacobian, initialQ, joints, nullSpaceJointLimitStep, rotationVector, solvePositionIK } from '../src/core/robot';
import { buildShapeTrajectory } from '../src/core/trajectory';

describe('8-DOF kinematics', () => {
  it('geometric Jacobian matches central numerical Jacobian within 1e-5', () => {
    const q = [0.21, -0.37, 6.2, 0.63, -0.41, 0.3, -0.52, 0.18];
    const { Jv, Jw } = geometricJacobian(q);
    const eps = 1e-6;
    for (let c = 0; c < 8; c++) {
      const qPlus = [...q]; qPlus[c] += eps;
      const qMinus = [...q]; qMinus[c] -= eps;
      const fkPlus = forwardKinematics(qPlus);
      const fkMinus = forwardKinematics(qMinus);
      const diff = fkPlus.points.at(-1)!.sub(fkMinus.points.at(-1)!).multiplyScalar(1 / (2 * eps));
      const rot_num = rotationVector(
        new THREE.Quaternion().setFromRotationMatrix(fkMinus.transform),
        new THREE.Quaternion().setFromRotationMatrix(fkPlus.transform)
      ).multiplyScalar(1 / (2 * eps));
      // Jv columns must match numerical position Jacobian
      expect(Math.abs(Jv[0][c] - diff.x)).toBeLessThan(1e-5);
      expect(Math.abs(Jv[1][c] - diff.y)).toBeLessThan(1e-5);
      expect(Math.abs(Jv[2][c] - diff.z)).toBeLessThan(1e-5);
      // Jw columns must match numerical rotation Jacobian
      expect(Math.abs(Jw[0][c] - rot_num.x)).toBeLessThan(1e-5);
      expect(Math.abs(Jw[1][c] - rot_num.y)).toBeLessThan(1e-5);
      expect(Math.abs(Jw[2][c] - rot_num.z)).toBeLessThan(1e-5);
    }
  });

  it('projects a near-limit joint step into the Jacobian null space', () => {
    const q = [joints[0].max - 0.02, 0.1, 9.5, -0.2, 0.1, 0, 0.1, 0];
    const { Jv } = geometricJacobian(q);
    const step = nullSpaceJointLimitStep(Jv, q, 0.18, 0.025);
    const taskLeak = Jv.map(row => row.reduce((sum, value, index) => sum + value * step[index], 0));
    expect(step[0]).toBeLessThan(0);
    expect(Math.hypot(...taskLeak)).toBeLessThan(0.002);
  });

  it('draws a closed circle while preserving the tool orientation', () => {
    const trajectory = buildShapeTrajectory('circle', 48);
    expect(trajectory.maxPositionError).toBeLessThan(0.07);
    expect(trajectory.maxOrientationError).toBeLessThan(0.09);
    expect(trajectory.actualPoints[0].distanceTo(trajectory.actualPoints.at(-1)!)).toBeLessThan(0.04);
  });

  it('recovers a forward-kinematics position with seeded IK', () => {
    const source = [0.25, 0.55, 5.7, -0.3, 0.25, 0.1, 0.2, -0.1];
    const target = forwardKinematics(source).points.at(-1)!;
    const result = solvePositionIK(target, initialQ);
    expect(result.error).toBeLessThan(0.04);
  });

  it('matches textbook reference matrices for all 5 course presets (aid0 - aid4)', () => {
    COURSE_PRESETS.forEach(preset => {
      const { maxDiff, posError } = evaluatePresetDiscrepancy(preset.q, preset.theoreticalMatrix);
      // Theoretical values in PDF have 3 to 4 decimal digits
      expect(posError).toBeLessThan(0.005);
      expect(maxDiff).toBeLessThan(0.005);
    });
  });

  it('solves Lab 3 waypoints with solvePositionIK', () => {
    // All waypoints are verified reachable FK positions from course presets
    const waypoints = [
      new THREE.Vector3(5.019, 6.098, 11.433),   // aid0: [0, π/4, 5, 0, -π/2, 0, π/6, 0]
      new THREE.Vector3(3.098, -4.880, -0.019),   // aid1: [-π/2, π/4, 6, 0, π/2, 0, -π/6, 0]
      new THREE.Vector3(6.243, -8.485, 3.586),    // aid2: [-π/2, π/4, 7, 0, π/2, 0, π/4, 0]
      new THREE.Vector3(-2.000, 9.364, 15.778),   // aid3: [π/2, π/4, 8, 0, -π/2, 0, -π/4, 0]
      new THREE.Vector3(6.098, 4.880, 8.466),     // aid4: [-π/2, -π/4, 5, 0, -π/2, 0, π/3, 0]
    ];
    let seed = [...COURSE_PRESETS[1].q];
    for (const pt of waypoints) {
      const res = solvePositionIK(pt, seed, 250);
      expect(res.converged).toBe(true);
      seed = res.q;
    }
  });

  it('generates continuous course trajectories within joint limits', () => {
    const patrol = buildShapeTrajectory('lab2_patrol');
    expect(patrol.samples.length).toBeGreaterThan(100);
    patrol.samples.forEach(q => q.forEach((val, idx) => {
      expect(val).toBeGreaterThanOrEqual(joints[idx].min - 1e-4);
      expect(val).toBeLessThanOrEqual(joints[idx].max + 1e-4);
    }));

    const lab3 = buildShapeTrajectory('lab3_loop');
    expect(lab3.samples.length).toBeGreaterThan(100);
    lab3.samples.forEach(q => q.forEach((val, idx) => {
      expect(val).toBeGreaterThanOrEqual(joints[idx].min - 1e-4);
      expect(val).toBeLessThanOrEqual(joints[idx].max + 1e-4);
    }));
    // Lab 3 is a closed loop trajectory: start point and end point should match
    expect(lab3.actualPoints[0].distanceTo(lab3.actualPoints.at(-1)!)).toBeLessThan(0.01);
  });
});
