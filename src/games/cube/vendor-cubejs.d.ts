export default class Cube {
  constructor();
  static initSolver(): void;
  static fromString(facelets: string): Cube;
  move(moves: string): Cube;
  asString(): string;
  isSolved(): boolean;
  solve(maxDepth?: number): string;
}
