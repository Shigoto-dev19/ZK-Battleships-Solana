/// An simple and raw example on how to play a simple Battleship game on terminal 
import readline from 'readline';

type Board = Array<Array<string>>;

const BOARD_SIZE = 10;
const SHIP_SIZE = 3;

const board: Board = new Array(BOARD_SIZE)
  .fill(null)
  .map(() => new Array(BOARD_SIZE).fill(' '));

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function printBoard(board: Board) {
  console.log('  ' + Array.from({ length: BOARD_SIZE }, (_, i) => i + 1).join(' '));
  for (let row = 0; row < BOARD_SIZE; row++) {
    console.log(String.fromCharCode(row + 65) + ' ' + board[row].join(' '));
  }
}

function placeShip(board: Board) {
  console.log(`Placing a ship of size ${SHIP_SIZE}`);
  const [startRow, startCol] = getRandomCoord();
  const orientation = Math.random() < 0.5 ? 'horizontal' : 'vertical';

  for (let i = 0; i < SHIP_SIZE; i++) {
    const row = startRow + (orientation === 'vertical' ? i : 0);
    const col = startCol + (orientation === 'horizontal' ? i : 0);
    board[row][col] = 'O';
  }
}

function getRandomCoord(): [number, number] {
  const row = Math.floor(Math.random() * BOARD_SIZE);
  const col = Math.floor(Math.random() * BOARD_SIZE);
  return [row, col];
}

function isHit(row: number, col: number) {
  return board[row][col] === 'O';
}

let numShips = 0;
let numHits = 0;

function play() {
  rl.question('Enter a coordinate (e.g. A1): ', (input) => {
    const row = input.charCodeAt(0) - 65;
    const col = parseInt(input.slice(1)) - 1;

    if (isHit(row, col)) {
      console.log('Hit!');
      board[row][col] = 'X';
      numHits++;
      if (numHits === SHIP_SIZE) {
        console.log('You sunk my battleship!');
        numHits = 0;
        numShips++;
        if (numShips === 3) {
          console.log('Congratulations, you won!');
          rl.close();
        } else {
          placeShip(board);
        }
      }
    } else {
      console.log('Miss!');
      board[row][col] = 'M';
    }

    printBoard(board);
    play();
  });
}

placeShip(board);
printBoard(board);
play();
