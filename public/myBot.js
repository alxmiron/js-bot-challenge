//
// Aggresive strategy "run-and-kick"- all players run to ball and kick it
// if possible to any direction
//

'use strict'; // eslint-disable-line

const PI = Math.PI;

const GOALKEEPER = 1;
// const PLAYER2 = 0;
// const PLAYER3 = 2;

const GOALKEEPER_POS_X = 0.07; // % of field width
const GoalkeeperModes = {
  FOLLOW: 'FOLLOW', // align Y with the ball, but keep goalkeeper X distance
  DEFENCE: 'DEFENCE', // move toward the ball
  DEFAULT: 'FOLLOW',
};

// const POS_EPS = 1;
// const DIR_EPS = PI / 180;

function getPlayerMove(data) {
  const currentPlayer = data.yourTeam.players[data.playerIndex];
  let moveObj = {
    direction: currentPlayer.direction,
    velocity: 0,
  };

  switch (data.playerIndex) {
    case GOALKEEPER:
      moveObj = calculateGoalkeeperMove(data);
      break;
    default:
  }

  return {
    direction: moveObj.direction,
    velocity: moveObj.velocity,
  };
}


// -------------------------------------
// Goalkeeper
// -------------------------------------
function calculateGoalkeeperMove(data) {
  const ball = data.ball;
  const ballStop = getBallStats(ball, data.settings);
  const player = data.yourTeam.players[data.playerIndex];

  const fieldWidth = data.settings.field.width;
  // const fieldHeight = data.settings.field.height;
  const ballRadius = data.settings.ball.radius;
  const playerRadius = data.settings.player.radius;
  const maxPlayerVelocity = data.settings.player.maxVelocity;
  const goalkeeperZoneEnd = GOALKEEPER_POS_X * 4 * fieldWidth;

  const mode = ballStop.x < goalkeeperZoneEnd ?
    GoalkeeperModes.DEFENCE :
    GoalkeeperModes.FOLLOW;

  let moveDirection = player.direction;
  let moveVelocity = 0;

  // ballStop.x = fieldWidth / 2;
  // ballStop.y = fieldHeight * 0.1;

  // if (!shouldGoalkeeperMove(mode, player, ball, ballStop)) {
  //   return {
  //     direction: moveDirection,
  //     velocity: moveVelocity,
  //   };
  // }

  const currentPoint = player;
  const targetPoint = mode === GoalkeeperModes.FOLLOW ? {
    x: GOALKEEPER_POS_X * fieldWidth,
    y: ballStop.y,
  } : {
    x: ballStop.x - ballRadius,
    y: ballStop.y,
  };
  const targetDirection = getDirectionTo(currentPoint, targetPoint);
  const targetDistance = getDistance(currentPoint, targetPoint);

  moveDirection = targetDirection;
  const directionDelta = targetDirection - convertEngineDirection(player.direction);
  moveVelocity = getGoalkeeperVelocity(
    mode,
    getPlayerVelocity(
      player.velocity,
      directionDelta,
      maxPlayerVelocity,
      2,
    ),
    targetDistance,
    playerRadius,
    maxPlayerVelocity,
  );

  return {
    direction: moveDirection,
    velocity: moveVelocity,
  };
}

// function shouldGoalkeeperMove(mode, goalkeeper, ball, ballStop) {
//   switch (mode) {
//     case GoalkeeperModes.FOLLOW:
//       if (ballStop.stopTime === 0 && Math.abs(ball.y - goalkeeper.y) < POS_EPS) {
//         return false;
//       }
//       break;
//     default:
//   }
//   return true;
// }

function getGoalkeeperVelocity(
  mode = GoalkeeperModes.DEFAULT,
  velocity,
  distance,
  playerRadius,
  maxPlayerVelocity,
) {
  switch (mode) {
    case GoalkeeperModes.FOLLOW:
      return slowStopGoalkeeper(velocity, distance, playerRadius, maxPlayerVelocity);
    case GoalkeeperModes.DEFENCE:
      return velocity;
    default:
  }
  return null;
}

function slowStopGoalkeeper(velocity, distance, playerRadius, maxPlayerVelocity) {
  let newVelocity = velocity;
  const stopThreshold = playerRadius * (velocity / maxPlayerVelocity) * 8;
  if (distance < stopThreshold) {
    newVelocity = 0;
  }
  return newVelocity;
}


// -------------------------------------
// Ball utils
// -------------------------------------
function getBallStats(ball, gameSettings) {
  const stopTime = getBallStopTime(ball);
  const stopDistance = (ball.velocity * stopTime)
    - (ball.settings.moveDeceleration * (((stopTime + 1) * stopTime) / 2));

  const x = ball.x + (stopDistance * Math.cos(ball.direction));
  let y = Math.abs(ball.y + (stopDistance * Math.sin(ball.direction)));

  // check the reflection from field side
  if (y > gameSettings.field.height) y = (2 * gameSettings.field.height) - y;

  return {
    stopTime,
    stopDistance,
    x,
    y,
  };
}

function getBallStopTime(ball) {
  return ball.velocity / ball.settings.moveDeceleration;
}


// -------------------------------------
// Common utils
// -------------------------------------
function getDirectionTo(startPoint, endPoint) {
  return Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
}

function getDistance(point1, point2) {
  return Math.hypot(point1.x - point2.x, point1.y - point2.y);
}

function getPlayerVelocity(
  currentVelocity,
  directionDelta,
  maxVelocity,
  exponent = 1,
) {
  const velocity = Math.max(
    maxVelocity - (
      Math.pow((Math.abs(directionDelta) / (PI / 2)), exponent) * currentVelocity
    ),
    0,
  );
  return velocity;
}

function convertEngineDirection(engineDirection) {
  return engineDirection > PI ? engineDirection - (2 * PI) : engineDirection;
}

// -------------------------------------
onmessage = e => postMessage(getPlayerMove(e.data));
