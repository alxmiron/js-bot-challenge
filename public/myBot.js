//
// Aggresive strategy "run-and-kick"- all players run to ball and kick it
// if possible to any direction
//

'use strict'; // eslint-disable-line

const GOALKEEPER = 1;
// const PLAYER2 = 0;
// const PLAYER3 = 2;

const GOALKEEPER_POS_X = 0.056; // % of field width
const EPS = 1;

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
  const goalkeeperZoneEnd = GOALKEEPER_POS_X * 3 * fieldWidth;
  let moveDirection = player.direction;
  let moveVelocity = 0;

  if (doesGoalkeeperShouldMove(player, ball, ballStop)) { // Need to move
    if (ballStop.x < goalkeeperZoneEnd) {

      // TODO move toward the ball
      moveDirection = getDirectionTo(player, {
        x: ballStop.x - data.settings.player.radius,
        y: ballStop.y,
      });
      moveVelocity = data.settings.player.maxVelocity;

    } else {

      // TODO align Y with the ball, but keep goalkeeper X distance
      moveDirection = getDirectionTo(player, {
        x: GOALKEEPER_POS_X * fieldWidth,
        y: ballStop.y,
      });
      moveVelocity = data.settings.player.maxVelocity;

    }
  } // esle stop player

  return {
    direction: moveDirection,
    velocity: moveVelocity,
  };
}

function doesGoalkeeperShouldMove(goalkeeper, ball, ballStop) {
  if (ballStop.stopTime < EPS && Math.abs(ball.y - goalkeeper.y) < EPS) {
    return false;
  }
  return true;
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

// function getDistance(point1, point2) {
//   return Math.hypot(point1.x-point2.x, point1.y - point2.y);
// }

// -------------------------------------
onmessage = e => postMessage(getPlayerMove(e.data));
