(() => {
  let teams = {
    'Soviet Union': [0, 0xffd900, [0xcd0000]],
    'European Harlot': [0, 0xffcc00, [0x000099]],
    'Nigeria': [0, 0x11ff33, [0x006600]],
    'Vatican': [0, 0xffffff, [0xffe100]],
    'Brazil': [90, 0x008800, [0xeeee00, 0xeeee00, 0x0000cc]],
    'Poland': [90, 0x000000, [0xeeeeee, 0xeeeeee, 0xee0000]],
    'Germany': [90, 0x222222, [0xeeeeee, 0xeeeeee, 0x000000]],
    'Argentina': [0, 0x000000, [0x75aadb, 0xeeeeee, 0x75aadb]],
  };

  let form = document.createElement('fieldset');
  form.style = "width: 800px; position: relative; padding: 5px 10px";
  form.innerHTML = `
<legend>Select team colors:</legend>
<div style="width: 400px; float: left">
<label for="red">"Red" team:</label><br/>
<select id="red"></select>
</div>
<div style="width: 400px; float: left">
<label for="blue">"Blue" team:</label><br/>
<select id="blue"></select>
</div>
</fieldset>`;

  var bdiv = document.createElement('div');
  bdiv.style = "width: 400px; padding: 10px 0; clear: both";
  var button = document.createElement('button');
  button.innerHTML = 'Start game';
  bdiv.appendChild(button);
  form.appendChild(bdiv);
  let doc = document.getElementsByTagName('iframe')[0].contentDocument;
  doc.body.insertBefore(form, doc.getElementById('recaptcha'));

  let s1 = doc.getElementById('red');
  let s2 = doc.getElementById('blue');
  let teamkeys = Object.keys(teams);
  let opt = (key, val) => { let op = document.createElement('option'); op.value = key; op.appendChild(document.createTextNode(val)); return op }
  for (let i = 0; i < teamkeys.length; i++) {
    let team = teamkeys[i];
    let o1 = opt(team, team), o2 = opt(team, team);
    if (i == 0)
      o1.selected = true;
    else if (i == 1)
      o2.selected = true;
    s1.appendChild(o1); s2.appendChild(o2);
  }

  let preventSame = (me, him) => (() => {
    if (me.value == him.value)
      him.selectedIndex = (him.selectedIndex + 1) % him.options.length;
  });
  s1.onchange = preventSame(s1, s2);
  s2.onchange = preventSame(s2, s1);

  button.onclick = () => {
    form.style.display = 'none';
    var room = HBInit({ roomName: "Stratsroom", maxPlayers: 8, public: false });
    room.setDefaultStadium("Big");
    room.setScoreLimit(8);
    room.setTimeLimit(8);
    room.setTeamColors.apply(null, [1].concat(teams[s1.value]));
    room.setTeamColors.apply(null, [2].concat(teams[s2.value]));

    var plnames = {}
    var stats = {}
    getPlayers = () => room.getPlayerList().filter((player) => player.id != 0);
    // If there are no admins left in the room give admin to one of the remaining players.
    function updateAdmins() { 
      // Get all players except the host (id = 0 is always the host)
      var players = getPlayers();
      if ( players.length == 0 ) return; // No players left, do nothing.
      if ( players.find((player) => player.admin) != null ) return; // There's an admin left so do nothing.
      room.setPlayerAdmin(players[0].id, true); // Give admin to the first non admin player in the list
    }

    function distance(pos1, pos2) {
      return Math.sqrt((pos1.x - pos2.x)**2 + (pos1.y - pos2.y)**2)
    }

    function touches(player, ballPos) {
      const ballSize = 10;
      const playerSize = 15;
      const tolerance = 4;

      if (player.position == null)
        return false;
      let dist = distance(player.position, ballPos);
      return dist < ballSize + playerSize + tolerance ? dist : false;
    }

    function possession() {
      let t = stats.teams[1].ticks + stats.teams[2].ticks;
      if (t) {
        let percent = Math.round(100*stats.teams[1].ticks / t);
        room.sendChat(`POSSESSION: ${s1.value}: ${percent} %, ${s2.value}: ${100 - percent} %`);
      } else
        room.sendChat(`POSSESSION: None`);
    }

    let chatmsg = '';
    function chatlog(msg) {
      if (msg) {
        room.sendChat(msg);
        chatmsg += msg + '\n';
      } else {
        console.log(chatmsg);
        chatmsg = '';
      }
    }
    
    function fullstats() {
      let t = stats.teams[1].ticks + stats.teams[2].ticks;
      if (t) {
        let percent = Math.round(100*stats.teams[1].ticks / t);
        chatlog(`POSSESSION: ${s1.value}: ${percent}%, ${s2.value}: ${100 - percent}%`);
        let pstats = []
        for (let pid in stats.players)
          pstats.push([Math.round(100*stats.players[pid].ticks / t), plnames[pid]]);
        pstats.sort((a, b) => parseFloat(b) - parseFloat(a));
        for (let i = 0; i < pstats.length; i++)
          chatlog(` ${i+1}. ${pstats[i][1]}: ${pstats[i][0]}%`);
      } else
        chatlog(`POSSESSION: None`);
      chatlog('PASSES: ' +
          `${s1.value}: ${stats.teams[1].passes}, consec.: ${stats.teams[1].mcpasses}, ` +
          `${s2.value}: ${stats.teams[2].passes}, consec.: ${stats.teams[2].mcpasses}`);
      let pstats = [];
      for (let pid in stats.players)
        pstats.push([stats.players[pid].passes, plnames[pid]]);
      pstats.sort((a, b) => parseInt(b) - parseInt(a));
      for (let i = 0; i < pstats.length; i++)
        chatlog(` ${i+1}. ${pstats[i][1]}: ${pstats[i][0]}`);
      if (stats.goals.length > 0) {
        chatlog('GOALS: ');
        for (let g of stats.goals)
          chatlog(`  [${g.time}] ${g.msg}`);
      }
      chatlog();
    }

    room.onPlayerJoin = (player) => {
      plnames[player.id] = player.name;
      updateAdmins();
      if (stats.started)
        stats.players[player.id] = {passes: 0, ticks: 0}
    }

    room.onPlayerLeave = (player) => {
      updateAdmins();
    }

    room.onGameStart = (player) => {
      stats = {
        started: true,
        kicked: {},
        touchtime: 0,
        touched: {},
        touchedBefore: {},
        teams: {1:{passes: 0, mcpasses: 0, cpn: 0, ticks: 0}, 2:{passes: 0, mcpasses: 0, cpn: 0, ticks: 0}},
        goals: [],
        players: {}
      };
      for (let player of getPlayers())
        stats.players[player.id] = {passes: 0, ticks: 0}
    }

    room.onPositionsReset = () => {
      stats.kicked = {};
      stats.touched = {};
      stats.touchtime = 0;
      stats.touchedBefore = {};
      stats.teams[1].cpn = 0;
      stats.teams[2].cpn = 0;
    }

    room.onPlayerBallKick = (player) => {
      console.log(`Player ${player.name} kicked the ball (last touch: ${stats.touched.name})`)
      stats.kicked = player;
      if (stats.touched.id != player.id) {
        let passer = stats.touchedBefore = stats.touched;
        let passee = stats.touched = player;
        if (passer) {
          if (passer.team == passee.team) {
            console.log(`Player ${passer.name} passed to ${passee.name}`)
              stats.teams[passer.team].passes++;
            stats.teams[passer.team].cpn++;
            if (stats.teams[passer.team].mcpasses < stats.teams[passer.team].cpn)
              stats.teams[passer.team].mcpasses = stats.teams[passer.team].cpn;
            stats.players[passer.id].passes++;
          } else {
            // another team got the ball
            // reset consecutive passes count
            console.log(`Player ${passee.name} took over the ball from ${passer.name}`);
            stats.teams[passer.team].cpn = 0;
          }
        }
      }
//      const ball = room.getBallPosition();
//      console.log(`kick distance: ${distance(ball, player.position)}`)
    }

    let lastsec = '';
    room.onGameTick = () => {
      const when = room.getScores().time;
      let min = Math.floor(when / 60).toString(), sec = (when % 60).toFixed(2);
      if (when > 0 && sec != lastsec && sec == 0 && min % 2 == 0)
        possession();
      lastsec = sec;

      const ball = room.getBallPosition();
      let touching = {};
      let closest = [];
      for (let player of getPlayers()) {
        if (player.team < 1)
          continue;
        let dist;
        if (dist = touches(player, ball)) {
          if (closest[0] == null || dist < closest[0].dist)
            closest[0] = {dist: dist, player: player};
          if (closest[player.team] == null || dist < closest[player.team])
            closest[player.team] = {dist: dist, player: player};
          touching[player.id] = player;
          stats.teams[player.team].ticks++;
          stats.players[player.id].ticks++;
        }
      }
      if (closest[0] != null) {
        /* someone still touches */
        /* passes */
        if (stats.touched.id) {
          if (touching[stats.touched.id]) {
            // previous player still touches
            stats.touchtime++;
            if (stats.kicked.id && stats.touchtime >= 10)
              stats.kicked = {}
          } else {
            if (stats.touchtime > 0)
              console.log(`Player ${stats.touched.name} touched ball for ${stats.touchtime} ticks`);
            stats.touchtime = 1;
            stats.touchedBefore = stats.touched;
            if (closest[stats.touched.team] != null) {
              // someone else from same team
              // that means a successful pass
              let passer = stats.touched, passee = closest[stats.touched.team].player;
              console.log(`Player ${passer.name} passed to ${passee.name}`)
              stats.teams[passer.team].passes++;
              stats.teams[passer.team].cpn++;
              if (stats.teams[passer.team].mcpasses < stats.teams[passer.team].cpn)
                stats.teams[passer.team].mcpasses = stats.teams[passer.team].cpn;
              stats.players[passer.id].passes++;
              stats.touched = passee;
            } else {
              // another team got the ball
              // reset consecutive passes count
              console.log(`Player ${closest[0].player.name} took over the ball from ${stats.touched.name}`)
              stats.teams[stats.touched.team].cpn = 0;
              stats.touched = closest[0].player;
            }
          }
        } else {
          stats.touchtime = 1;
          stats.touched = closest[0].player;
          console.log(`Player ${stats.touched.name} touched the ball`)
        }
      } else {
        if (stats.touched.id && stats.touchtime > 0) {
          console.log(`Player ${stats.touched.name} touched ball for ${stats.touchtime} ticks`);
          stats.touchtime = 0;
        }
      }
    };

    room.onTeamGoal = (team) => {
      const teams = {1: s1.value, 2: s2.value}
      const scorer = stats.touched;
      const assistant = stats.touchedBefore;
      const own = scorer.team != team;
      const when = room.getScores().time;

      let min = Math.floor(when / 60).toString(), sec = Math.round(when % 60).toString();
      let msg = `${own ? 'OWN' : ''}GOAL for ${teams[team]} by ${scorer.name}` + (assistant ? `, assisted: ${assistant.name}, ${stats.teams[team].cpn} consecutive passes`: '');
      let time = `${min.length < 2 ? '0' : ''}${min}:${sec.length < 2 ? '0' : ''}${sec}`;
      console.log(`Goal at: ${when}, min: ${min}, sec: ${sec}`)
      stats.goals.push({time: time, msg: msg});
      room.sendChat(`[${time}] ${msg}`);
    }

    room.onGameStop = () => {
      fullstats();
    }
  }
})();