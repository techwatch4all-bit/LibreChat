const mathsteps = require('mathsteps');

const args = process.argv.slice(2);
const command = args[0] || 'solve';
const expr = args[1] || '2x + 3 = 11';

try {
  if (command === 'solve') {
    const steps = mathsteps.solveEquation(expr);
    const result = steps.map((s) => {
      let oldEq = '';
      if (s.oldEquation) {
        oldEq = s.oldEquation.ascii();
      } else if (s.oldNode) {
        oldEq = s.oldNode.toString();
      }

      let newEq = '';
      if (s.newEquation) {
        newEq = s.newEquation.ascii();
      } else if (s.newNode) {
        newEq = s.newNode.toString();
      }

      return {
        changeType: s.changeType,
        oldEquation: oldEq,
        newEquation: newEq,
      };
    });
    console.log(
      JSON.stringify({ status: 'success', type: 'equation', input: expr, steps: result }),
    );
  } else if (command === 'simplify') {
    const steps = mathsteps.simplifyExpression(expr);
    const result = steps.map((s) => ({
      changeType: s.changeType,
      oldNode: s.oldNode ? s.oldNode.toString() : '',
      newNode: s.newNode ? s.newNode.toString() : '',
    }));
    console.log(
      JSON.stringify({ status: 'success', type: 'expression', input: expr, steps: result }),
    );
  } else {
    console.log(JSON.stringify({ status: 'error', message: `Unknown command: ${command}` }));
  }
} catch (e) {
  console.log(JSON.stringify({ status: 'error', message: e.message, input: expr }));
}
