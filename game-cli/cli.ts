import chalk from 'chalk';

function stringifyBoard(board: string[][]) {
  let rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  let columns = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  let space = '   ';
  let col = '\n ';
  
  //let columns = '\n     ' =           
  let nested_board = '\n  -----------------------------------------\n';
  for (let i=0; i<10; i++) {
      col += space + columns[i]
      nested_board += `${rows[i]} | ${board[i][0]} | ${board[i][1]} | ${board[i][2]} | ${board[i][3]} | ${board[i][4]} | ` +
      `${board[i][5]} | ${board[i][6]} | ${board[i][7]} | ${board[i][8]} | ${board[i][9]} |\n` +
      '  -----------------------------------------\n';     
  }
  
  return col + nested_board
}
// Create a 10x10 nested array
function nestifyArray(flat_array: string[]) {
  const nested_array = Array.from({ length: 10 }, (_, i) => flat_array.slice(i * 10, (i + 1) * 10));
  return nested_array
}

function printBoard(board1, board2) {

  const rows1 = board1.split('\n');
  const rows2 = board2.split('\n');

  //console.log('-----------------------------------------');  
  let space1 = '         ';
  let space2 = '            ';
  let board_header1 = '                 Your Board                ';
  let board_header2 = "             You Opponet's Board           ";

  console.log('\n' + space1 + board_header1 + space2 + board_header2);
  console.log('\n' + space1 + rows1[1] + space2 + '  '+ rows2[1]);
  for (let i = 2; i < rows1.length; i++) {
      
    console.log(space1 + rows1[i] + space2 + rows2[i]);
  }
}

function parse_gameBoard(board: string[][]): string[][] {
  
  let initial_board = new Array(100).fill(' ');
  initial_board = nestifyArray(initial_board);
  
  const lengths = [5, 4, 3, 3, 2];
  
  for (let index=0; index<lengths.length; index++) {
    
    let length = lengths[index];
    for (let i=0; i<length; i++) {
      if (board[index][2] === '1') {
        
        let x = Number(board[index][1]) + i;
        let y = Number(board[index][0]); 
        initial_board[x][y] = '\u{1F6E5}';
      }
      else {

        let x = Number(board[index][1]);
        let y = Number(board[index][0]) + i;
        initial_board[x][y] = '\u{1F6E5}';
      }
    }
  }
  return initial_board
} 

export {
  parse_gameBoard,
  stringifyBoard,
  printBoard,
  nestifyArray
}
