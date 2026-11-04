// Curated local dictionaries. Exact word matching avoids treating content words
// as filler just because their Snowball stem collides with a function word.
const words = (text) => new Set(text.trim().split(/\s+/u));
const pronouns = {
  ru: words(`я меня мне мной мною мы нас нам нами ты тебя тебе тобой тобою вы вас вам вами
    он она оно они его ее её ему ей им их ним них него нее неё нему ней ею ими
    себя себе собой собою мой моя мое моё мои моего моей моему моим моих мою моими
    твой твоя твое твоё твои твоего твоей твоему твоим твоих твою твоими
    наш наша наше наши нашего нашей нашему нашим наших нашу нашими
    ваш ваша ваше ваши вашего вашей вашему вашим ваших вашу вашими
    свой своя свое своё свои своего своей своему своим своих свою своими
    этот эта это эти этого этой этому этим этих эту этими тот та то те того той тому тем тех ту теми
    кто что кого чего кому чему кем чем какой какая какое какие каков какова каково каковы
    который которая которое которые которого которой которому которым которых которую которыми
    чей чья чье чьё чьи чьего чьей чьему чьим чьих чью чьими
    весь вся все всё всего всей всему всем всех всю всеми каждый каждая каждое каждые
    сам сама само сами самый самая самое самые любой любая любое любые иной другая другой
    никто ничто никого ничего никому ничему никем ничем некого нечего некто нечто
    кто-то что-то кто-нибудь что-нибудь кто-либо что-либо кое-кто кое-что`),
  en: words(`i me my mine myself we us our ours ourselves you your yours yourself yourselves
    he him his himself she her hers herself it its itself they them their theirs themselves
    this that these those who whom whose whoever whomever what whatever which whichever
    somebody someone something anybody anyone anything everybody everyone everything
    nobody noone nothing each either neither one oneself`),
};
const interjections = {
  ru: words(`ах ох ух эх ой ай эй ого ага угу увы браво ура фу тьфу хм гм ну ау ба ха хи о охо хаха хе э эм мм мда`),
  en: words(`oh ah uh um hmm hm hey wow alas oops ouch hooray hurrah huh ugh phew shh aha eh yep nope gosh gee ha haha`),
};
const stopwords = {
  ru: words(`а без безо благодаря будто бы был была были было быть в во ведь вне вот вроде все-таки всегда всего где да даже для до если есть еще ещё же за зато здесь и из из-за из-под или ибо иначе итак к ко как когда конечно куда ли либо лишь между мимо на над надо назад наиболее например насчет насчёт не небось нежели нельзя нет ни нибудь никогда нигде но ну нужно о об обо однако около опять от ото очень перед передо по под подо после потому поэтому почти при про против пусть пускай ради разве раз рядом с со совсем так также таки такой там тогда тоже только тут у уже хотя хоть чем через чтоб чтобы чуть якобы более больше менее меньше можно может могут мог могла могли должно должна должен должны будем будет будете будешь будут будь будьте были бывать ведь впрочем действительно именно иногда кажется как-то кстати между прочим необходимо обычно особенно пока поскольку просто снова совершенно теперь туда зачем отчего откуда почему прочее прочие прочих то-то то есть то-есть`),
  en: words(`a an the and or but if because as until while of at by for with about against between into through during before after above below to from up down in out on off over under again further then once here there when where why how all any both few more most other some such no nor not only own same so than too very can will just don should now is am are was were be been being have has had having do does did doing would could must shall may might also yet already ever never much many less least almost quite rather really still even however therefore thus perhaps well indeed actually basically literally obviously simply
    don't doesn't didn't isn't aren't wasn't weren't won't wouldn't can't cannot couldn't shouldn't mustn't needn't haven't hasn't hadn't i'm you're he's she's it's we're they're i've you've we've they've i'll you'll he'll she'll we'll they'll i'd you'd he'd she'd we'd they'd that's there's here's what's who's let's`),
};

function classify(word, language) {
  if (!language) return 'content';
  if (pronouns[language].has(word)) return 'pronoun';
  if (interjections[language].has(word)) return 'interjection';
  if (stopwords[language].has(word)) return 'stopword';
  if (Array.from(word.replace(/['-]/gu, '')).length < 3) return 'short';
  return 'content';
}

module.exports = { classify };
