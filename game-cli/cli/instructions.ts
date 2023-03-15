import chalk from 'chalk';
function salmon (str) {
    return chalk.keyword('salmon')(str);
}
const INSTRUCTIONS = `
\rType ${chalk.red('help')} and hit return at any time to show these instructions.\r

${chalk.bold('Other helpful commands:')}
- Type ${salmon('show score')} at any time to check the status of the game.
- Type ${salmon('quit')} or ${salmon('q')} at any time to quit the game.\r

${chalk.bold('Settings:')}
- ${chalk.red('NOTE:')} If your terminal does not support Emojis, please disable Emojis in the settings menu.
- For a more challenging game, you can choose a larger board size.
- You can also adjust the computer's skill level.\r

${chalk.bold('How to win:')}
- Each player has a battlefield represented by a 10x10 grid (default) on which they place 5 ships, hidden to their opponent.
- The goal of the game is sink all of your opponents ships! A ship is sunk when it is hit once for each space it occupies.
- In other words, a submarine, which occupies 3 spaces, is sunk after being hit 3 times.
- The 5 ships occupy 17 total spaces, so the first player to register 17 hits wins!\r

${chalk.bold('Gameplay:')}
- To play, follow the prompts to configure your five ships in any pattern you'd like (diagonal placements are not allowed).
- Valid configuration instructions include a ship name, a starting coordinate (A1-J10 for default 10x10 board), and a direction (right, left, up or down).
- For example: ${salmon('submarine e3 up')} or ${salmon('carrier j7 left')}. Ships cannot overlap, and you must stay within the bounds of the board.
- Once both players have configured their ships, the race is on to sink your opponent's ships before they sink yours!
- Fire torpedoes at your opponent's ships by guessing coordinates on the board.
- Rows are represented by the letters A-J, and columns with the numbers 1-10 (10x10 board).
- Valid guesses include a row followed by a column, e.g. ${salmon('A1')}, ${salmon('B7')}, ${salmon('J10')}, etc.
- You will be informed if you've hit, missed, or sunk a ship.
- Sink all 5 of the computer's ships to win!\r

${chalk.bold('Hint:')}
- When placing ships, you can also use abbreviations to make your life easier!
- Use the ship's abbreviations (see legend), and single letters for directions.
- e.g. ${salmon('btl a9 r')} or ${salmon('cru i6 u')}\r

${chalk.bold('Legend:')}
- Battleship (BTL), 4 spaces
- Carrier (CAR), 5 spaces
- Cruiser (CRU), 3 spaces
- Destroyer (DST), 2 spaces
- Submarine (SUB), 3 spaces
- A hit looks like 💥  or ${chalk.bgKeyword('orange').red.bold(' X ')} (depending on Emoji support)
- A miss looks like ❌  or ${chalk.bgKeyword('blue').cyan.bold(' 0 ')} (depending on Emoji support)
`;
const HELPER = `\nType the command ${salmon('show score')} and press ${chalk.green('return')} at any time to check the status of the game!\n`;
const WELCOME = chalk.green('?') + '  Welcome to ZKBattleship CLI! ' + chalk.cyan('Let\'s Play!\n');

export {
    INSTRUCTIONS,
    HELPER,
    WELCOME,
    salmon
}
