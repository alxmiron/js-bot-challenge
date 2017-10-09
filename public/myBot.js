'use strict'; // eslint-disable-line

// -------------------------------------
// Constants
// -------------------------------------
const PI = Math.PI;

const PLAYMAKER_TOP = 0;
const GOALKEEPER = 1;
const PLAYMAKER_BOTTOM = 2;

const GOALKEEPER_POS_X = 80 / 708; // % of field width
const GoalkeeperModes = {
  FOLLOW: 'FOLLOW', // align Y with the ball, but keep goalkeeper X distance
  DEFENCE: 'DEFENCE', // move toward the ball
};

const Zones = {
  G: 'G',
  PT: 'PT',
  PB: 'PB',
};

const PlayerZone = {
  [GOALKEEPER]: Zones.G,
  [PLAYMAKER_TOP]: Zones.PT,
  [PLAYMAKER_BOTTOM]: Zones.PB,
};

const POS_EPS = 2;


// -------------------------------------
// Main
// -------------------------------------
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
      moveObj = calculatePlaymakerMove(data, data.playerIndex);
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
  const ballStop = getBallStop(ball, data.settings);
  const player = data.yourTeam.players[data.playerIndex];

  const zones = getZonesParams(data);
  const goalkeeperZoneEnd = zones[Zones.G].end;

  const mode = (ballStop.x < goalkeeperZoneEnd || ball.x < goalkeeperZoneEnd) ?
    GoalkeeperModes.DEFENCE :
    GoalkeeperModes.FOLLOW;

  const currentPoint = player;
  const distanceToBall = getDistance(currentPoint, ball);
  const targetPoint = getGoalkeeperBallTargetPoint(data, mode);
  const moveDirection = getDirectionTo(currentPoint, targetPoint);
  const targetDistance = getDistance(currentPoint, targetPoint);
  const directionDelta = moveDirection - convertEngineDirection(player.direction);

  const moveVelocity = getGoalkeeperVelocity(
    data,
    mode,
    getPlayerVelocity(
      data,
      player.velocity,
      directionDelta,
    ),
    targetDistance,
    distanceToBall,
  );

  return {
    direction: moveDirection,
    velocity: moveVelocity,
  };
}

function getGoalkeeperBallTargetPoint(data, mode) {
  const fieldWidth = data.settings.field.width;
  const ballRadius = data.settings.ball.radius;

  let targetPoint = getBallTargetPoint(data);
  switch (mode) {
    case GoalkeeperModes.FOLLOW:
      targetPoint = {
        x: GOALKEEPER_POS_X * fieldWidth,
        y: targetPoint.y + posNoize(ballRadius),
      };
      break;
    default:
  }

  return targetPoint;
}

function getGoalkeeperVelocity(data, mode, velocity, targetDistance, distanceToBall) {
  const ball = data.ball;
  const player = data.yourTeam.players[data.playerIndex];
  const maxPlayerVelocity = data.settings.player.maxVelocity;
  const ballRadius = data.settings.ball.radius;

  switch (mode) {
    case GoalkeeperModes.DEFENCE:
      return (distanceToBall <= (ballRadius * 2) && player.x < ball.x) ?
        maxPlayerVelocity :
        velocity;
    default:
      return velocity;
  }
}


// -------------------------------------
// Playmakers
// -------------------------------------
function calculatePlaymakerMove(data, playmakerType) {
  const player = data.yourTeam.players[data.playerIndex];
  const ball = data.ball;

  const zones = getZonesParams(data);
  const ballZone = detectPointZone(data, zones, ball);

  let firstRun = false;
  if (ballZone.center) {
    firstRun = true;
  } else {
    firstRun = false;
  }

  const currentPoint = player;
  const targetPoint = getPlaymakerBallTargetPoint(data, playmakerType, firstRun);
  const moveDirection = getDirectionTo(currentPoint, targetPoint);
  const directionDelta = moveDirection - convertEngineDirection(player.direction);

  const moveVelocity = getPlayerVelocity(
    data,
    player.velocity,
    directionDelta,
  );

  return {
    direction: moveDirection,
    velocity: moveVelocity,
  };
}

function getPlaymakerBallTargetPoint(data, playmakerType, firstRun) {
  const ball = data.ball;
  const player = data.yourTeam.players[data.playerIndex];
  const playerRadius = data.settings.player.radius;
  const ballRadius = data.settings.ball.radius;
  const satelliteOffsetX = playerRadius * 3;
  const satelliteOffsetY = playerRadius * 6;

  const targetPoint = getBallTargetPoint(data);
  const zones = getZonesParams(data);
  const ballZone = detectPointZone(data, zones, ball);

  if (firstRun) return targetPoint;

  if (player.x + (playerRadius * 2) < ball.x) { // Attack
    if (playmakerType === PLAYMAKER_TOP && ballZone.zone === Zones.PB) { // Satellite mode
      targetPoint.x -= satelliteOffsetX;
      targetPoint.y -= satelliteOffsetY + posNoize(ballRadius);
    } else if (playmakerType === PLAYMAKER_BOTTOM && ballZone.zone === Zones.PT) { // Satellite mode
      targetPoint.x -= satelliteOffsetX;
      targetPoint.y += satelliteOffsetY + posNoize(ballRadius);
    }
  }

  return targetPoint;
}

// Archive
function calculateAttackPlaymakerMove(data, playmakerType, firstRun) {
  const player = data.yourTeam.players[data.playerIndex];
  const ball = data.ball;
  const ballRadius = data.settings.ball.radius;
  const maxPlayerVelocity = data.settings.player.maxVelocity;

  const currentPoint = player;
  let targetPoint = ball;
  if (firstRun) {
    targetPoint = {
      x: ball.x - ballRadius,
      y: ball.y + posNoize(ballRadius),
    };
  }
  const targetDirection = getDirectionTo(currentPoint, targetPoint);
  const directionDelta = targetDirection - convertEngineDirection(player.direction);

  const moveDirection = Math.atan2(targetPoint.y - currentPoint.y, targetPoint.x - currentPoint.x - ballRadius);
  const moveVelocity = firstRun ? maxPlayerVelocity : getPlayerVelocity(
    data,
    player.velocity,
    directionDelta,
  );

  return {
    direction: moveDirection,
    velocity: moveVelocity,
  };
}

function calculateDefencePlaymakerMove(data, playmakerType) {
  const player = data.yourTeam.players[data.playerIndex];
  const ball = data.ball;

  const moveDirection = player.direction;
  const moveVelocity = 0;

  if (ball.x > player.x) {
    return calculateAttackPlaymakerMove(data, playmakerType);
  }

  return {
    direction: moveDirection,
    velocity: moveVelocity,
  };
}

function calculateFollowPlaymakerMove(data, playmakerType, ballStop, zones) {
  const player = data.yourTeam.players[data.playerIndex];
  const playerRadius = data.settings.player.radius;
  const ballRadius = data.settings.ball.radius;
  const maxPlayerVelocity = data.settings.player.maxVelocity;
  const playerZone = PlayerZone[playmakerType];

  const currentPoint = player;
  const targetPoint = {
    x: Math.max((ballStop.x + posNoize(ballRadius)) - (playerRadius * 6), 0),
    y: getPlaymakerFollowPositionY(zones[playerZone]),
  };
  const targetDirection = getDirectionTo(currentPoint, targetPoint);
  const directionDelta = targetDirection - convertEngineDirection(player.direction);

  const moveDirection = targetDirection;
  const moveVelocity = getPlayerVelocity(
    data,
    player.velocity,
    directionDelta,
    maxPlayerVelocity,
  );

  return {
    direction: moveDirection,
    velocity: moveVelocity,
  };
}

function getPlaymakerFollowPositionY(zone) {
  return zone.top + ((zone.bottom - zone.top) / 2);
}


// -------------------------------------
// Ball utils
// -------------------------------------
function getBallStop(ball, gameSettings) {
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

function getPlayerVelocity(data, currentVelocity, directionDelta, exponent = 2) { // Formula 1
  const maxVelocity = data.settings.player.maxVelocity;
  const velocity = Math.max(
    maxVelocity - (
      Math.pow((Math.abs(directionDelta) / (PI / 2)), exponent) * currentVelocity
    ),
    0,
  );
  return velocity;
}

function convertEngineDirection(engineDirection) { // Formula 2
  if (engineDirection > PI) return engineDirection - (2 * PI);
  if (engineDirection < -PI) return engineDirection + (2 * PI);
  return engineDirection;
}

function getZonesParams(data) {
  const fieldWidth = data.settings.field.width;
  const fieldHeight = data.settings.field.height;
  const goalkeeperZoneEnd = (fieldWidth / 2) * 0.8;

  return {
    [Zones.G]: {
      start: 0,
      end: goalkeeperZoneEnd,
      top: 0,
      bottom: fieldHeight,
    },
    [Zones.PT]: {
      start: goalkeeperZoneEnd,
      end: fieldWidth,
      top: 0,
      bottom: fieldHeight * 0.5,
    },
    [Zones.PB]: {
      start: goalkeeperZoneEnd,
      end: fieldWidth,
      top: fieldHeight * 0.5,
      bottom: fieldHeight,
    },
  };
}

function detectPointZone(data, zones, point) {
  const field = data.settings.field;
  const x = point.x;
  const y = point.y;
  const eps = data.settings.ball.radius * 4;
  const result = {
    zone: null,
    defence: false,
    aggressive: false,
    center: false,
    closeToEdge: false,
  };

  if (x > zones[Zones.G].end) {
    if (y < zones[Zones.PT].bottom) {
      result.zone = Zones.PT;
    } else {
      result.zone = Zones.PB;
    }
    if (Math.abs(y - zones[Zones.PT].bottom) < eps) {
      result.closeToEdge = true;
    }
    if (x < field.width * 0.5) {
      result.defence = true;
    } else {
      result.aggressive = true;
    }
  } else {
    result.zone = Zones.G;
  }
  if (Math.abs(x - (field.width / 2) < POS_EPS) &&
      Math.abs(y - (field.height / 2) < POS_EPS)) {
    result.center = true;
  }

  return result;
}

function isPointInField(data, point) {
  const fieldWidth = data.settings.field.width;
  const fieldHeight = data.settings.field.height;

  if (point.x >= 0 && point.x <= fieldWidth &&
      point.y >= 0 && point.y <= fieldHeight) {
    return true;
  }

  return false;
}

function posNoize(range) {
  return (Math.random() * (range * 2)) - range;
}

function getBallTargetPoint(data) {
  const ball = data.ball;
  const player = data.yourTeam.players[data.playerIndex];
  const ballRadius = data.settings.ball.radius;
  const playerRadius = data.settings.player.radius;

  const ballStop = getBallStop(ball, data.settings);
  const distanceToBall = getDistance(player, ball);

  let targetPoint;
  if (ball.x < player.x && ball.x - (playerRadius * 2) < player.x) { // Need to take position behind the ball
    const option1 = {
      x: ball.x - (playerRadius * 2),
      y: ball.y - (playerRadius * 2),
    };
    const option2 = {
      x: ball.x - (playerRadius * 2),
      y: ball.y + (playerRadius * 2),
    };
    const distToOption1 = getDistance(player, option1);
    const distToOption2 = getDistance(player, option2);
    if (isPointInField(data, option1) && distToOption1 < distToOption2) {
      targetPoint = option1;
    } else if (isPointInField(data, option2) && distToOption2 < distToOption1) {
      targetPoint = option2;
    } else {
      targetPoint = {
        x: ball.x - ballRadius,
        y: ball.y,
      };
    }
  } else if (distanceToBall <= ballRadius * 2) { // Ball is very close, run to it
    targetPoint = {
      x: ball.x - ballRadius,
      y: ball.y,
    };
  } else if ((4 / 5) * PI < ball.direction && ball.direction < (6 / 5) * PI) {
    targetPoint = {
      x: ball.x,
      y: ball.y,
    };
  } else {
    targetPoint = {
      x: ballStop.x - ballRadius,
      y: ballStop.y,
    };
  }

  return targetPoint;
}

// Archive
function slowStopPlayer(velocity, distance, playerRadius, maxPlayerVelocity) { // Formula 3
  let newVelocity = velocity;
  const stopThreshold = playerRadius * (velocity / maxPlayerVelocity) * 8;
  if (distance < stopThreshold) {
    newVelocity = 0;
  }
  return newVelocity;
}

function convertPlayerDirection(playerDirection) {
  return playerDirection > PI ? playerDirection + (2 * PI) : playerDirection;
}

// -------------------------------------
onmessage = e => postMessage(getPlayerMove(e.data));
