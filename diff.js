let canvas = $('#canvas');
let table = $('#words');

function parse_conllu(text) {
  let words = [{
	  id: 0,
	  form: 'ROOT',
	  lemma: 'ROOT',
	  upos: 'ROOT',
	  head: '_',
	  label: '_',
  }];
  text.split('\n').forEach(function(line) {
	  let cols = line.trim().split('\t');
	  if (cols.length != 10) return;
	  if (!cols[0].match(/^[0-9]+$/)) return;
	  words.push({
	    id: parseInt(cols[0]),
	    form: cols[1],
	    lemma: cols[2],
	    upos: cols[3],
	    head: (cols[6] == '_' ? '_' : parseInt(cols[6])),
	    label: cols[7],
	  });
  });
  return words;
}

function arc_path(baseline, head, dep, height) {
  let d = (head < dep) ? +1 : -1;
  return `M ${head} ${baseline}
L ${head + d*10*(height + 1)} ${baseline - 70*height}
L ${dep - d*10*(height + 1)} ${baseline - 70*height}
L ${dep} ${baseline}`;
}

function arc_head(baseline, dep) {
  let s = 'M '+dep + ' ' + baseline + ' ';
  s += 'L ' + (dep - 6) + ' ' + (baseline - 10) + ' ';
  s += 'L ' + (dep + 6) + ' ' + (baseline - 10) + ' Z';
  return s;
}

function arc_contains(big, little) {
  if (big.head == little.dep && big.dep == little.head) {
    return big.head < little.head;
  } else if (big.head == little.head && big.dep == little.dep) {
	  return big.cls == 'del';
  } else if (big.head < big.dep) {
    return (big.head <= little.head &&
            big.head <= little.dep &&
            little.head <= big.dep &&
            little.dep <= big.dep);
  } else {
    return (big.dep <= little.head &&
            big.dep <= little.dep &&
            little.head <= big.head &&
            little.dep <= big.head);
  }
}

function update_trees() {
  $('#info').html('');
  let oldtree = parse_conllu($('#old').val());
  let newtree = parse_conllu($('#new').val());
  if (oldtree.length != newtree.length) {
    if (oldtree.length > 0 || newtree.length > 0) {
      $('#info').html('The trees have different lengths.');
    }
    return;
  }

  if ($('#rtl').is(':checked')) {
	  oldtree.reverse();
	  newtree.reverse();
	  for (i = 0; i < oldtree.length; i++) {
	    if (oldtree[i].head != '_') {
		    oldtree[i].head = oldtree.length - oldtree[i].head - 1;
	    }
	    if (newtree[i].head != '_') {
		    newtree[i].head = newtree.length - newtree[i].head - 1;
	    }
	  }
  }

  let words = '';
  for (let key of ['id', 'form', 'lemma', 'upos']) {
	  words += '<tr>';
	  for (i = 0; i < oldtree.length; i++) {
	    let o = oldtree[i][key];
	    let n = newtree[i][key];
	    if (o == n) words += '<td>'+o+'</td>';
	    else words += '<td><del>'+o+'</del><ins>'+n+'</ins></td>';
	  }
	  words += '</tr>';
  }
  $('#words').html(words);

  let canvas = $('#canvas');
  canvas.html('');
  canvas.attr('width', $('#words')[0].getBoundingClientRect().width);
  let offset = canvas[0].getBoundingClientRect().left;

  let arcs = [];
  for (i = 0; i < oldtree.length; i++) {
	  let oh = oldtree[i]['head'];
	  let ol = oldtree[i]['label'];
	  let nh = newtree[i]['head'];
	  let nl = newtree[i]['label'];
	  if (oh == '_' && nh == '_') continue;
	  if (oh == nh && ol == nl) {
	    arcs.push({
		    'head': oh,
		    'dep': i,
		    'label': ol,
		    'cls': 'same',
		    'height': 0,
	    });
	  } else {
	    if (oh != '_') {
		    arcs.push({
		      'head': oh,
		      'dep': i,
		      'label': ol,
		      'cls': 'del',
		      'height': 0,
		    });
	    }
	    if (nh != '_') {
		    arcs.push({
		      'head': nh,
		      'dep': i,
		      'label': nl,
		      'cls': 'ins',
		      'height': 0,
		    });
	    }
	  }
  }
  let relevant = arcs.map(function(a, idx) {
	  let ret = [];
	  for (i = 0; i < arcs.length; i++) {
	    if (i == idx) continue;
	    if (arc_contains(a, arcs[i])) ret.push(i);
	  }
	  return ret;
  });

  let todo = arcs.map((_, i) => i);
  while (todo.length > 0) {
	  let next = [];
	  todo.forEach(function(i) {
	    let heights = relevant[i].map((j) => arcs[j].height);
	    if (heights.length == 0) {
		    arcs[i].height = 1;
	    } else if (heights.indexOf(0) == -1) {
		    arcs[i].height = Math.max(...heights) + 1;
	    } else {
		    next.push(i);
	    }
	  });
	  if (todo.length == next.length) break;
	  todo = next;
  }
  let all_heights = arcs.map((a) => a.height);
  let max_height = Math.max(...all_heights);

  let centers = Array.from($('#words').children()[0].children).map(
	  function(w) {
	    let r = w.getBoundingClientRect();
	    return ((r.left + r.right) / 2) - offset;
	  }
  );

  let baseline = max_height * 100 - 20;
  canvas.attr('height', max_height * 100);
  canvas.html(arcs.map(
	  function(arc) {
	    let head = centers[arc.head];
	    let dep = centers[arc.dep];
	    let label = arc.label;
	    if (head < dep) {
		    label += '&gt;';
	    } else {
		    label = '&lt;' + label;
	    }
	    return `
<g class="${arc.cls}">
  <path d="${arc_path(baseline, head, dep, arc.height)}"/>
  <path d="${arc_head(baseline, dep)}"/>
  <text x="${(head+dep)/2}" y="${baseline - arc.height*70 - 20}">${label}</text>
</g>`;
	  }
  ).join(''));
}

$(function() {
  $('#old,#new,#rtl').change(update_trees);
  update_trees();
});
