import fetch from 'node-fetch';
import fs from 'fs';
import jsdom from 'jsdom';
const { JSDOM } = jsdom;

const BASE_URL = 'https://www.unibo.it/en/teaching/course-unit-catalogue/course-unit/';

function getItemized(node) {
  let textContent = '\n';
  for (let cc of node.children) {
    if (cc.nodeName == "UL" || cc.nodeName == "OL") {
      return getItemized(cc);
    }
    textContent += `+ ${cc.textContent.trim()}\n`;
  }
  return textContent;
}

async function getTitleDesc(link) {
  const course = getCourseCode(link);
  link = `${BASE_URL}${course}`
  let res = await fetch(link)
  let source = await res.text();
  const { document } = new JSDOM(source).window;

  const titletext = document.getElementById('u-content-intro');
  const title = titletext.textContent.trim();
  const descText = document.getElementsByClassName('description-text')[0];
  const children = descText.children;
  let found = false;
  let description = ''
  for (let c of children) {
    let textContent = (c.textContent).trim();
    if (found) {
      if (c.nodeName == 'H2') {
        return { title, description, link };
      }
      if (c.nodeName == "UL" || c.nodeName == "OL") {
        textContent = getItemized(c);
      }
      description += textContent + '\n';
    }
    if (textContent == 'Course contents') {
      found = true;
    }
  }
}

async function resolveURL(url) {
  let res = await fetch(url, {
    redirect: 'manual'
  })

  return res.headers.get('location');
}

function getCourseCode(link) {
  let reg = 'insegnamento/'
  let code = link.substring(link.indexOf(reg) + reg.length)
  return code;
}

async function getCoursesTitlesAndDesc(element) {
  const titlesRaw = element.getElementsByClassName('title');
  let titles = [];
  for (let t of titlesRaw) {
    const linkEl = t.children[0];
    if (linkEl) {
      const link = await resolveURL(linkEl.getAttribute('href'));
      if (link) {
        let titledesc = await getTitleDesc(link)
        if (titledesc) {
          titles.push(titledesc);
        }
      }
    }
  }
  return titles;
}

function getCourseName(url) {
  return (/laurea\/(.*?)\/insegnamenti/gm).exec(url)[1];
}

async function getCourses(pianoDidatticoURL) {
  let md = '## {ENTER YOUR COURSE NAME}\nby {firstname surname}\n';

  let res = await fetch(pianoDidatticoURL);
  let source = await res.text();
  const { document } = new JSDOM(source).window;
  const table_text = document.getElementsByClassName('table-text')[0];
  let title_found = false;
  let title = "";
  for (let c of table_text.children) {
    if (!title_found) {
      title = c.textContent.trim();
      if (title.toLowerCase().includes("primo anno"))
        title = "First Year"
      if (title.toLowerCase().includes("secondo anno"))
        title = "Second Year"
      if (title.toLowerCase().includes("terzo anno"))
        title = "Third Year"
      if (title.toLowerCase().includes("quarto anno"))
        title = "Fourth Year"
      if (title.toLowerCase().includes("quinto anno"))
        title = "Fifth Year"
      if (title.toLowerCase().includes("libera scelta"))
        title = "Optional Courses"
      title_found = true;
    }
    if (title_found && c.nodeName == "TABLE") {
      title_found = false;
      let info = await getCoursesTitlesAndDesc(c);
      md += `### ${title}\n`;
      for (let i of info) {
        md += `#### ${i.title}\n${i.description}\n`;
        md += `[${i.link}](${i.link})\n`;
      }
      md += '\n';
    }
  }

  fs.writeFileSync(`${getCourseName(pianoDidatticoURL)}.md`, md);
  return md;
}

// url del piano didattico
getCourses('https://corsi.unibo.it/laurea/informatica/insegnamenti/piano/2022/8009/000/000/2022');
