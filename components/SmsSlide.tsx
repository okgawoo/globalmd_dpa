import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'

type ToneType = '정중' | '친근' | '애교' | '간결'
type SituationType = '최근미팅' | '최근계약' | '생일임박' | '완납임박' | '보장공백' | '만기임박' | '장기미연락' | '첫인사' | '계약기념일' | '일반'

const TONES: ToneType[] = ['정중', '친근', '애교', '간결']
const EMOJIS = ['😊','😄','🎂','🎉','🎊','💚','📞','🙏','👍','✅','🔥','💪','⭐','🌟','❤️']

// 각 상황별 톤별 3개 변형 스크립트
const SCRIPTS: Record<SituationType, Record<ToneType, string[]>> = {
  최근미팅: {
    정중: [
      `안녕하세요 {name} 님,\n지난번 만남에서 말씀 나눈 시간이 정말 유익했습니다.\n{name} 님께서 말씀해 주신 부분들을 토대로 더 좋은 방안을 검토해 보았습니다.\n보험은 한번 설계로 끝나는 것이 아니라 꾸준히 점검해 드리는 것이 저의 역할이라 생각합니다.\n편하신 시간에 연락 주시면 자세히 안내드리겠습니다.\n- 담당 설계사 드림`,
      `안녕하세요 {name} 님,\n지난번 귀한 시간 내어 주셔서 진심으로 감사드렸습니다.\n그 자리에서 나눴던 이야기를 다시 한번 정리해 보았는데, 좋은 방향이 보여서 연락드립니다.\n{name} 님의 상황에 맞는 방안을 준비해 두었으니, 편하실 때 말씀 주세요.\n항상 최선을 다해 도와드리겠습니다.\n- 담당 설계사 드림`,
      `안녕하세요 {name} 님,\n지난 미팅 이후로 {name} 님의 보험 상황을 꼼꼼히 살펴보았습니다.\n말씀하신 내용이 마음에 남아 좀 더 유익한 제안을 드릴 수 있을 것 같아 연락드렸습니다.\n바쁘신 중에 시간 내어 주셔서 다시 한번 감사드리며, 편하신 시간에 연락 주시면 감사하겠습니다.\n- 담당 설계사 드림`,
    ],
    친근: [
      `안녕하세요 {name} 님! 😊\n지난번에 뵙고 너무 좋았어요!\n말씀해 주신 내용이 계속 머릿속에 남아서요, 더 좋은 방법이 없을까 계속 생각해봤어요.\n아마 {name} 님한테 딱 맞는 방안을 찾은 것 같아요!\n시간 되실 때 편하게 연락 주세요, 기다릴게요 😊`,
      `안녕하세요 {name} 님! 😄\n지난번 만남 이후로 {name} 님 생각이 나더라고요 ㅎㅎ\n그때 나눴던 이야기 기억하시죠? 그 부분을 좀 더 살펴봤는데요,\n도움이 될 만한 좋은 내용이 있어서 꼭 한번 말씀드리고 싶어서 연락드렸어요!\n언제 시간 괜찮으세요? 📞`,
      `안녕하세요 {name} 님! 😊\n지난번에 만나고 나서 기분이 너무 좋았어요!\n그때 말씀하신 게 계속 마음에 걸려서요, 더 잘 챙겨드리고 싶다는 생각이 들었어요.\n{name} 님한테 딱 필요한 정보가 있을 것 같아서 연락드렸어요!\n편하실 때 연락주세요 💚`,
    ],
    애교: [
      `{name} 님~ 지난번에 만나서 진짜 즐거웠어요! 😄\n계속 생각이 나서 연락드렸어요 ㅎㅎ\n그때 말씀하신 거 있잖아요, 더 좋은 방법을 찾아봤거든요!\n꼭 한번 들어보셨으면 해서요~ 시간 되실 때 연락해 주세요! 💚`,
      `{name} 님~ 지난번 만남 이후로 어떻게 지내세요? 😊\n저는 그날 이후로 {name} 님 보험 더 잘 챙겨드려야겠다는 생각을 계속 했어요!\n좋은 소식이 생겨서 빨리 알려드리고 싶었거든요 🎉\n편하신 때 꼭 연락해주세요~!`,
      `{name} 님~ 안녕하세요! 😄\n지난번에 너무 즐거운 시간이었어요!\n{name} 님 생각이 나서 연락드렸어요 💚\n작은 것도 놓치지 않고 챙겨드리고 싶어서요!\n시간 될 때 통화해요~! 📞`,
    ],
    간결: [
      `{name} 님, 안녕하세요.\n지난 미팅 이후 추가로 검토한 내용이 있습니다.\n편하신 시간에 연락 주시면 안내드리겠습니다.`,
      `{name} 님, 지난번 만남 감사했습니다.\n관련하여 좋은 방안을 찾았습니다. 연락 부탁드립니다.`,
      `{name} 님, 최근 미팅 후 추가 검토 결과를 공유드리고 싶습니다.\n시간 되실 때 연락 주세요.`,
    ],
  },
  최근계약: {
    정중: [
      `안녕하세요 {name} 님,\n소중한 가입 결정에 진심으로 감사드립니다.\n앞으로 {name} 님의 보험이 꼭 필요한 순간에 든든한 버팀목이 될 수 있도록 최선을 다하겠습니다.\n보험은 가입 후 관리가 더 중요하다고 생각합니다.\n언제든지 궁금하신 점이 생기시면 편하게 연락 주세요.\n항상 곁에서 도움이 되겠습니다.\n- 담당 설계사 드림`,
      `안녕하세요 {name} 님,\n보험 가입을 믿고 맡겨 주셔서 진심으로 감사드립니다.\n앞으로 {name} 님과 가족분들의 소중한 일상을 보호하는 데 최선을 다하겠습니다.\n혹시 보험 내용 중 궁금하신 사항이 있으시거나, 추가로 확인이 필요하신 부분이 있으시면 언제든지 연락 주시기 바랍니다.\n- 담당 설계사 드림`,
      `안녕하세요 {name} 님,\n가입해 주신 보험, 꼼꼼히 관리해 드리겠습니다.\n보험증권이 발급되면 한번 더 안내드릴 예정이며,\n이후에도 주기적으로 보장 내용을 점검해 드릴게요.\n언제든 편하게 연락 주세요.\n- 담당 설계사 드림`,
    ],
    친근: [
      `안녕하세요 {name} 님! 😊\n가입해 주셔서 정말 감사해요!\n앞으로 {name} 님의 보험, 제가 꼼꼼하게 챙겨드릴게요!\n혹시 보험 내용 중 헷갈리거나 궁금한 부분 있으시면 언제든지 연락 주세요.\n작은 것도 놓치지 않고 잘 안내해 드릴게요 💚`,
      `안녕하세요 {name} 님! 🎉\n저를 믿고 가입해 주셔서 너무너무 감사해요!\n이제부터 {name} 님 보험은 제가 책임지고 관리할게요!\n언제든 궁금한 거 생기시면 부담 없이 연락주세요.\n항상 최선을 다해서 도와드릴게요 😊`,
      `안녕하세요 {name} 님! 😄\n소중한 결정 해주셔서 진심으로 감사드려요!\n앞으로 {name} 님 가족 모두 건강하고 행복하게 지내실 수 있도록 제가 든든히 곁에 있을게요!\n궁금한 거 있으시면 언제든지요 💚`,
    ],
    애교: [
      `{name} 님~ 가입해 주셔서 너무 감사해요! 🎉🎊\n이제 제가 {name} 님 보험 담당 설계사예요!\n잘 부탁드려요~ 😊\n앞으로 뭐든 궁금하신 거 있으시면 편하게 연락해 주세요!\n항상 열심히 챙겨드릴게요 💚`,
      `{name} 님~ 믿어주셔서 정말 감사해요! 😄\n앞으로 {name} 님 보험 꼭꼭 잘 챙길게요!\n보험 관련해서 어떤 작은 것도 궁금하시면 바로바로 연락주세요!\n늘 옆에 있을게요~ 💚`,
      `{name} 님~ 가입 축하드려요! 🎉\n이제부터 든든한 보장이 함께할 거예요!\n앞으로도 자주 연락드릴게요~ 😊\n잘 부탁드려요!`,
    ],
    간결: [
      `{name} 님, 가입 감사드립니다.\n앞으로 보험 관련 사항은 언제든지 연락 주세요. 성심껏 도와드리겠습니다.`,
      `{name} 님, 소중한 결정 감사합니다. 꼼꼼히 관리해 드리겠습니다.`,
      `{name} 님, 가입 감사드립니다. 궁금한 점은 언제든 연락 주세요.`,
    ],
  },
  생일임박: {
    정중: [
      `안녕하세요 {name} 님,\n생신을 진심으로 축하드립니다. 🎂\n항상 건강하시고 하시는 모든 일에 기쁨이 넘치시길 바랍니다.\n{name} 님과 가족분들 모두 건강하고 행복하게 지내시길 진심으로 바라며,\n앞으로도 늘 곁에서 든든한 버팀목이 되겠습니다.\n- 담당 설계사 드림`,
      `안녕하세요 {name} 님,\n오늘 이 특별한 날, 진심 어린 축하 말씀 전합니다. 🎂\n한 해 한 해 더 건강하시고 늘 웃음 가득한 나날이 되시길 기원드립니다.\n항상 {name} 님 곁에서 필요한 순간에 도움이 되고 싶습니다.\n좋은 하루 보내세요.\n- 담당 설계사 드림`,
      `안녕하세요 {name} 님,\n뜻깊은 생신을 맞이하여 진심으로 축하드립니다. 🎂\n건강하시고 행복한 일 가득하시길 바랍니다.\n앞으로도 변함없이 성심껏 도와드리겠습니다.\n- 담당 설계사 드림`,
    ],
    친근: [
      `안녕하세요 {name} 님! 😊\n생일 축하드려요! 🎂🎉\n오늘 하루만큼은 맛있는 것도 드시고 푹 쉬세요!\n{name} 님이 항상 건강하고 행복하게 지내셨으면 해요.\n앞으로도 좋은 일만 가득하시길 진심으로 바랄게요 💚`,
      `안녕하세요 {name} 님! 🎂\n오늘 생일이시잖아요!\n정말 진심으로 축하드려요!\n이 세상에 {name} 님이 태어나 주셔서 감사한 날이에요 😊\n오늘 하루 정말 특별하고 행복한 날 되세요!`,
      `안녕하세요 {name} 님! 😄\n생일 축하해요! 🎂🎉\n한 살 더 먹어도 여전히 멋지신 {name} 님!\n올 한 해도 건강하고 좋은 일만 가득하길 바랄게요 💚`,
    ],
    애교: [
      `{name} 님~ 생일 축하드려요! 🎂🎉🎊\n오늘 하루 정말 특별한 날이에요!\n맛있는 것도 드시고, 좋아하시는 것도 마음껏 하시고,\n푹 쉬시면서 행복한 하루 보내세요!\n항상 응원하고 있어요 💚`,
      `{name} 님~! 오늘 생일이잖아요! 🎂\n너무 축하드려요!!\n이 세상에 {name} 님이 있어줘서 정말 행복해요 😊\n오늘 하루 최고의 날 되세요~ 💚🎉`,
      `{name} 님~ 생일 축하해요! 🎂✨\n오늘만큼은 모든 걱정 내려놓고 즐거운 하루 보내세요!\n앞으로도 오래오래 건강하게 지내주세요~ 💚`,
    ],
    간결: [
      `{name} 님, 생일 진심으로 축하드립니다! 🎂\n건강하고 행복한 하루 보내세요 😊`,
      `{name} 님, 생신 축하드립니다! 🎂 항상 건강하세요.`,
      `{name} 님, 생일 축하드려요! 늘 건강하고 행복하시길 바랍니다. 🎂`,
    ],
  },
  완납임박: {
    정중: [
      `안녕하세요 {name} 님,\n가입하신 보험의 납입이 거의 마무리 단계에 접어들었습니다.\n그동안 꾸준히 납입해 오신 덕분에 이제 완납이 눈앞에 있습니다.\n완납 이후에는 보험료 부담 없이 동일한 보장을 유지하실 수 있으며,\n더 유리한 조건으로 보장을 재설계하는 방법도 검토해 드릴 수 있습니다.\n편하신 시간에 말씀 주시면 자세히 안내드리겠습니다.\n- 담당 설계사 드림`,
      `안녕하세요 {name} 님,\n오랜 기간 성실하게 보험료를 납입해 오신 {name} 님께 감사의 말씀을 드립니다.\n이제 완납이 코앞에 다가왔네요!\n완납 후에는 같은 보장을 유지하면서도 새로운 보장을 추가하거나,\n더욱 알찬 구조로 재설계하는 방법도 있습니다.\n곧 연락드릴 예정이오니 기대해 주세요.\n- 담당 설계사 드림`,
      `안녕하세요 {name} 님,\n보험 납입이 거의 완료될 예정입니다.\n그동안 꾸준히 유지해 주신 덕분에 소중한 보장이 잘 지켜지고 있습니다.\n완납 후 보다 효율적인 보험 운영 방법에 대해 말씀드릴 내용이 있으니,\n편하실 때 연락 주시면 감사하겠습니다.\n- 담당 설계사 드림`,
    ],
    친근: [
      `안녕하세요 {name} 님! 😊\n드디어 보험 납입이 거의 다 됐어요! 🎉\n그동안 정말 수고 많으셨어요!\n완납 이후에는 보험료 걱정 없이 똑같은 보장을 받으실 수 있고,\n더 좋은 조건으로 바꾸는 방법도 있거든요.\n시간 되실 때 한번 같이 이야기 나눠봐요! 📞`,
      `안녕하세요 {name} 님! 🎊\n납입이 거의 끝나가고 있어요!\n정말 대단하세요, 꾸준히 유지해 오신 거 쉬운 일이 아닌데요!\n완납 후에 더 유리하게 활용하는 방법이 있어요.\n꼭 한번 말씀드리고 싶어서 연락드렸어요 😊`,
      `안녕하세요 {name} 님! 💪\n이제 완납이 코앞이에요!\n그동안 성실하게 납입해 주셔서 정말 감사해요!\n완납 후에 더 좋은 혜택을 받으실 수 있는 방법이 있으니,\n시간 되실 때 꼭 한번 통화해요! 💚`,
    ],
    애교: [
      `{name} 님~ 드디어 완납 임박이에요! 🎊🎉\n정말 수고 많으셨어요!\n이제 조금만 더 하면 보험료 안 내도 보장받을 수 있어요!\n완납 후에 더 좋은 혜택으로 업그레이드해 드릴 수 있거든요~\n빨리 이야기 나눠봐요! 💚`,
      `{name} 님~! 납입이 거의 다 됐어요! 🎊\n대단하세요~ 정말요!\n완납하고 나면 제가 더 좋은 걸로 바꿔드릴 수 있어요!\n기대해 주세요~ 💚`,
      `{name} 님~ 완납 임박이에요! 💪🎉\n지금까지 너무 잘하셨어요!\n완납 후에 {name} 님한테 딱 맞는 더 좋은 보장으로 바꿔드릴게요!\n꼭 연락주세요~ 😊`,
    ],
    간결: [
      `{name} 님, 보험 납입이 거의 완료 예정입니다.\n완납 후 재설계 관련 상담 원하시면 연락 주세요.`,
      `{name} 님, 곧 완납입니다. 그동안 수고 많으셨습니다. 완납 후 추가 안내 드릴게요.`,
      `{name} 님, 납입 완료가 얼마 남지 않았습니다. 재설계 상담 연락 주세요.`,
    ],
  },
  보장공백: {
    정중: [
      `안녕하세요 {name} 님,\n{name} 님의 보험 내용을 꼼꼼히 검토하던 중,\n뇌혈관 관련 보장 부분에 공백이 있다는 것을 확인하게 되었습니다.\n최근 뇌혈관 질환 관련 보험금 청구 사례가 늘고 있어,\n{name} 님께서도 미리 보장을 강화해 두시는 것이 좋을 것 같아 연락드렸습니다.\n부담 없이 한번 상담해 드릴 수 있으니, 편하신 시간에 연락 주시면 감사하겠습니다.\n- 담당 설계사 드림`,
      `안녕하세요 {name} 님,\n{name} 님의 보험을 정기적으로 점검하던 중 보장 공백을 발견하여 연락드립니다.\n현재 뇌혈관 관련 보장이 충분하지 않은 상황인데,\n이 부분은 나중에 큰 차이를 만들 수 있는 중요한 보장입니다.\n{name} 님의 상황에 맞게 최적의 방안을 제안해 드릴 수 있으니,\n편하신 시간에 말씀 주세요.\n- 담당 설계사 드림`,
      `안녕하세요 {name} 님,\n담당 설계사로서 {name} 님의 보험을 정기 점검하던 중,\n보장 공백이 발견되어 안내드리고자 연락드렸습니다.\n이 부분은 미리 보완해 두시면 나중에 훨씬 든든하실 거예요.\n언제든 편하게 말씀 주세요.\n- 담당 설계사 드림`,
    ],
    친근: [
      `안녕하세요 {name} 님! 😊\n{name} 님 보험을 꼼꼼하게 살펴보다가 발견한 게 있어서 연락드렸어요.\n뇌혈관 쪽 보장이 좀 약하더라고요.\n요즘 뇌혈관 관련 보험금 지급 사례가 많이 늘고 있어서,\n미리 보완해 두시는 게 좋을 것 같아요!\n너무 걱정하실 필요 없고, 부담 없이 한번 이야기 나눠봐요 📞`,
      `안녕하세요 {name} 님! 😊\n{name} 님 보험 꼼꼼히 보다가 제가 좀 걱정이 됐어요.\n뇌혈관 관련 보장이 좀 부족한 부분이 있거든요.\n이 부분을 미리 챙겨두면 나중에 훨씬 든든하실 거예요!\n부담 없이 한번 상담해 드릴게요, 시간 되실 때 연락주세요 💚`,
      `안녕하세요 {name} 님! 😊\n열심히 보험 점검하다 보니 {name} 님 보장에 빈틈이 있는 걸 발견했어요.\n이런 부분을 미리 알려드리는 게 제 역할이라 생각해서 연락드렸어요.\n작은 부분이지만 나중에 큰 도움이 될 수 있어요!\n편하실 때 통화해요 📞`,
    ],
    애교: [
      `{name} 님~ 안녕하세요! 😊\n{name} 님 보험 살펴보다가 걱정이 돼서 연락드렸어요 😮\n뇌혈관 보장이 좀 빠져있거든요!\n이 부분은 꼭 챙겨드리고 싶어서요 💚\n잠깐만 통화 가능하세요? 📞`,
      `{name} 님~! 제가 {name} 님 보험 열심히 살펴봤는데요 😊\n보장 공백을 발견해버렸어요!\n더 잘 지켜드리고 싶어서 연락드렸어요 💚\n편하실 때 꼭 연락주세요~!`,
      `{name} 님~ 안녕하세요! 😊\n{name} 님 보험 꼼꼼히 보다가 빈틈을 발견했어요 😮\n이건 꼭 알려드려야 할 것 같아서요!\n잠깐 통화해요~ 💚📞`,
    ],
    간결: [
      `{name} 님, 보험 점검 중 뇌혈관 보장 공백이 확인됐습니다.\n보완 상담 원하시면 연락 주세요. 📞`,
      `{name} 님, 보장 공백이 있습니다. 상담 부탁드립니다.`,
      `{name} 님, 보험 검토 결과 보장 공백이 발견됐습니다. 연락 주세요.`,
    ],
  },
  만기임박: {
    정중: [
      `안녕하세요 {name} 님,\n가입하신 보험이 곧 만기가 도래하게 됩니다.\n만기 이후에는 해당 보험의 보장이 종료되므로,\n미리 대비하지 않으시면 보장 공백이 생길 수 있습니다.\n{name} 님의 현재 상황에 맞는 새로운 보장 방안을 준비해 드릴 수 있으니,\n편하신 시간에 연락 주시면 자세히 안내드리겠습니다.\n- 담당 설계사 드림`,
      `안녕하세요 {name} 님,\n중요한 안내를 드리고자 연락드립니다.\n현재 가입하신 보험이 만기 예정이어서,\n만기 후 보장 연속성을 위한 준비가 필요합니다.\n지금 미리 준비해 두시면 공백 없이 보장을 이어가실 수 있습니다.\n편하실 때 연락 주세요.\n- 담당 설계사 드림`,
      `안녕하세요 {name} 님,\n보험 만기가 얼마 남지 않아 안내드립니다.\n만기 후에도 보장이 계속될 수 있도록 미리 준비해 드리고 싶습니다.\n편하신 시간에 말씀 주시면 감사하겠습니다.\n- 담당 설계사 드림`,
    ],
    친근: [
      `안녕하세요 {name} 님! 😊\n알림 드릴 게 있어서 연락드렸어요!\n가입하신 보험이 곧 만기가 다가오고 있어요.\n만기 후에 보장 빈틈이 생기지 않도록 미리 준비하면 좋을 것 같아서요!\n지금 알아두시면 나중에 훨씬 편하실 거예요.\n시간 되실 때 통화해요! 📞`,
      `안녕하세요 {name} 님! 😊\n보험 만기가 다가오고 있어서 미리 알려드리려고요!\n이런 부분을 미리 챙겨드리는 게 제 역할이라 생각해요.\n만기 후에도 보장이 끊기지 않도록 좋은 방법이 있어요.\n편하실 때 한번 이야기 나눠봐요 💚`,
      `안녕하세요 {name} 님! 😊\n{name} 님 보험 만기가 얼마 안 남았더라고요!\n미리 알고 준비하시면 보장 공백 없이 이어갈 수 있어요.\n제가 좋은 방안 찾아봤으니까 꼭 한번 들어봐 주세요! 📞`,
    ],
    애교: [
      `{name} 님~ 중요한 소식 알려드릴게요! ⏰\n보험 만기가 다가오고 있어요!\n만기 후에 보장이 끊기면 안 되잖아요~\n제가 공백 없이 이어드릴 수 있는 방법을 찾아봤어요!\n빨리 말씀드리고 싶어서 연락드렸어요 💚`,
      `{name} 님~! 보험 만기가 얼마 안 남았어요! ⏰\n이런 거 미리미리 챙겨드려야 한다고 생각해서요 😊\n보장 공백 없이 쭉 이어질 수 있도록 제가 도와드릴게요!\n편하실 때 연락해주세요~ 💚`,
      `{name} 님~ 보험 만기 소식 미리 알려드려요! ⏰\n걱정 마세요, 제가 다 챙겨드릴게요 💚\n편하실 때 꼭 연락주세요~!`,
    ],
    간결: [
      `{name} 님, 보험 만기가 임박했습니다.\n만기 후 보장 공백을 방지하려면 미리 준비가 필요합니다. 연락 주세요.`,
      `{name} 님, 보험 만기 예정입니다. 재가입 상담 원하시면 연락 주세요.`,
      `{name} 님, 가입하신 보험이 곧 만기됩니다. 상담 부탁드립니다.`,
    ],
  },
  장기미연락: {
    정중: [
      `안녕하세요 {name} 님,\n담당 설계사입니다.\n오랫동안 연락을 드리지 못하여 죄송합니다.\n그동안 잘 지내고 계신지 안부가 궁금하여 연락드렸습니다.\n{name} 님의 보험도 시간이 지나면서 점검이 필요할 수 있습니다.\n혹시 보험 관련하여 궁금하신 점이 있으시거나 변경이 필요하신 사항이 있으시면 언제든지 말씀해 주세요.\n- 담당 설계사 드림`,
      `안녕하세요 {name} 님,\n오랜만에 연락드립니다.\n그동안 건강하고 잘 지내고 계신지요.\n가끔 {name} 님이 생각나 연락드리게 되었습니다.\n보험 관련 궁금한 점이나 도움이 필요하신 부분이 있으시면,\n언제든 편하게 말씀해 주세요.\n- 담당 설계사 드림`,
      `안녕하세요 {name} 님,\n담당 설계사로서 오랜만에 연락드립니다.\n{name} 님의 보험이 잘 유지되고 있는지, 또 삶의 변화로 인해 보장 내용을 점검할 시기가 됐는지 살펴보려 합니다.\n잠시 시간 내어 주실 수 있으시면 간략하게 안내드리겠습니다.\n- 담당 설계사 드림`,
    ],
    친근: [
      `안녕하세요 {name} 님! 😊\n오랜만에 연락드려요!\n그동안 잘 지내셨나요?\n갑자기 {name} 님 생각이 나서요 ㅎㅎ\n오래된 고객분들도 잊지 않고 꼭 챙겨드리고 싶어서 연락했어요!\n보험 관련해서 바뀐 게 있거나 궁금한 거 있으시면 편하게 말씀해 주세요 💚`,
      `안녕하세요 {name} 님! 😊\n정말 오랜만이에요!\n잘 지내고 계셨죠?\n연락을 자주 못 드려서 죄송해요.\n혹시 보험 관련해서 도움이 필요하신 것 없으셨나요?\n앞으로는 더 자주 연락드릴게요! 💚`,
      `안녕하세요 {name} 님! 😄\n오랜만에 안부 인사 드려요!\n그동안 건강하게 잘 지내고 계셨나요?\n{name} 님 생각이 나서 연락드렸어요.\n보험 관련 궁금한 거 있으시면 편하게 물어봐 주세요 💚`,
    ],
    애교: [
      `{name} 님~ 오랜만이에요! 😊\n그동안 잘 지내셨죠?\n제가 너무 오래 연락을 못 드렸죠? 죄송해요! 😅\n{name} 님이 생각나서 용기내서 연락드렸어요 ㅎㅎ\n혹시 보험 관련해서 궁금하신 거 있으시면 언제든 말씀해 주세요~ 💚`,
      `{name} 님~! 오랜만이에요! 😄\n잘 지내고 계신 거죠?\n갑자기 생각나서 연락했어요 ㅎㅎ\n보험 관련해서 뭐든 궁금하신 거 있으면 편하게 물어봐주세요~ 💚`,
      `{name} 님~ 안부 인사 드려요! 😊\n오랫동안 연락 못 드렸는데 잘 지내고 계시죠?\n{name} 님 생각이 나서요~\n무엇이든 도움이 필요하시면 연락주세요 💚`,
    ],
    간결: [
      `{name} 님, 오랜만에 안부 전합니다. 잘 지내시죠?\n보험 관련 궁금한 점 있으시면 연락 주세요.`,
      `{name} 님, 오랜만입니다. 보험 점검이 필요하시면 연락 주세요.`,
      `{name} 님, 안부 전합니다. 궁금하신 것 있으시면 편하게 연락 주세요.`,
    ],
  },
  첫인사: {
    정중: [
      `안녕하세요 {name} 님,\n처음 인사드립니다. 담당 설계사입니다.\n앞으로 {name} 님의 보험을 성심껏 관리해 드리겠습니다.\n보험은 가입으로 끝이 아니라 지속적인 관리가 중요합니다.\n궁금하신 점이나 필요하신 부분이 있으시면 언제든지 편하게 말씀해 주세요.\n잘 부탁드립니다.\n- 담당 설계사 드림`,
      `안녕하세요 {name} 님,\n처음으로 연락드립니다.\n앞으로 {name} 님의 보험 담당 설계사로서 든든하게 곁에서 도와드리겠습니다.\n보험에 대해 궁금하신 것이 있거나, 현재 보험이 충분한지 점검받고 싶으실 때 언제든지 연락 주세요.\n감사합니다.\n- 담당 설계사 드림`,
      `안녕하세요 {name} 님,\n담당 설계사입니다. 처음 연락드립니다.\n앞으로 보험 관련하여 무엇이든 도움이 필요하실 때 편하게 말씀해 주세요.\n성심껏 도와드리겠습니다.\n- 담당 설계사 드림`,
    ],
    친근: [
      `안녕하세요 {name} 님! 😊\n처음 인사드려요!\n앞으로 보험 관련해서 {name} 님 곁에서 든든하게 도와드릴 담당 설계사예요!\n보험은 사실 어렵고 복잡하게 느껴지실 수 있는데,\n제가 쉽고 친절하게 안내해 드릴게요!\n궁금한 거 있으시면 부담 없이 편하게 연락 주세요 💚`,
      `안녕하세요 {name} 님! 😄\n처음 연락드려요!\n저는 앞으로 {name} 님의 보험을 꼼꼼하게 챙겨드릴 담당 설계사예요!\n잘 부탁드려요~ 😊\n보험에 대해 궁금하신 거 있으시면 언제든지 편하게 물어봐 주세요!`,
      `안녕하세요 {name} 님! 😊\n처음으로 연락드립니다!\n앞으로 {name} 님 보험 잘 챙겨드릴게요!\n어떤 것도 부담 없이 물어봐 주세요 💚\n잘 부탁드려요!`,
    ],
    애교: [
      `{name} 님~ 처음 뵙겠습니다! 😄\n앞으로 보험 잘 챙겨드릴 담당 설계사예요!\n잘 부탁드려요~ 💚\n보험에 대해 궁금하신 거 있으시면 뭐든지 편하게 물어봐주세요!\n성심껏 도와드릴게요 😊`,
      `{name} 님~! 안녕하세요 처음 뵙겠습니다! 😊\n앞으로 {name} 님 보험 꼭꼭 잘 챙겨드릴게요!\n언제든지 편하게 연락주세요~ 💚`,
      `{name} 님~ 처음 인사드려요! 😊\n앞으로 잘 부탁드려요~!\n무엇이든 도움이 필요하시면 편하게 연락주세요 💚`,
    ],
    간결: [
      `{name} 님, 안녕하세요. 담당 설계사입니다.\n앞으로 잘 부탁드립니다. 궁금하신 점은 언제든 연락 주세요.`,
      `{name} 님, 처음 연락드립니다. 앞으로 보험 관리 잘 도와드리겠습니다.`,
      `{name} 님, 안녕하세요. 담당 설계사입니다. 잘 부탁드립니다.`,
    ],
  },
  계약기념일: {
    정중: [
      `안녕하세요 {name} 님,\n{name} 님과 인연을 맺은 지 벌써 시간이 많이 흘렀습니다.\n그동안 변함없이 믿고 맡겨 주셔서 진심으로 감사드립니다.\n앞으로도 {name} 님의 소중한 보험을 최선을 다해 관리해 드리겠습니다.\n항상 곁에서 든든한 버팀목이 되겠습니다.\n- 담당 설계사 드림`,
      `안녕하세요 {name} 님,\n{name} 님의 보험 계약 기념일을 맞이하여 연락드립니다.\n오랜 시간 함께해 주신 덕분에 저도 많이 성장할 수 있었습니다.\n앞으로도 더 나은 서비스로 보답하겠습니다.\n편하신 시간에 연락 주시면 보험 현황을 점검해 드리겠습니다.\n- 담당 설계사 드림`,
      `안녕하세요 {name} 님,\n보험 가입 기념일을 축하드립니다! 🎉\n그동안 성실하게 보험을 유지해 주셔서 감사합니다.\n{name} 님의 보장이 더욱 탄탄해질 수 있도록 지속적으로 점검해 드리겠습니다.\n- 담당 설계사 드림`,
    ],
    친근: [
      `안녕하세요 {name} 님! 😊\n오늘이 보험 가입 기념일이에요! 🎉\n시간이 정말 빠르죠?\n그동안 함께해 주셔서 정말 감사해요!\n앞으로도 {name} 님 곁에서 든든하게 챙겨드릴게요 💚`,
      `안녕하세요 {name} 님! 🎉\n보험 가입하신 지 벌써 이렇게 됐네요!\n그동안 잘 지내고 계셨죠?\n오랜 인연에 감사드리고 앞으로도 잘 부탁드려요!\n혹시 보험 관련해서 변경이 필요하신 거 있으시면 언제든지 연락주세요 💚`,
      `안녕하세요 {name} 님! 😄\n오늘 {name} 님 보험 기념일이에요! 🎊\n정말 오랫동안 함께해 주셔서 감사해요!\n앞으로도 더 잘 챙겨드릴게요 💚`,
    ],
    애교: [
      `{name} 님~ 오늘 보험 기념일이에요! 🎉🎊\n시간이 정말 빠르죠? 저는 {name} 님과의 인연이 너무 소중해요 💚\n앞으로도 오래오래 함께해요!`,
      `{name} 님~! 기념일 축하드려요! 🎉\n그동안 믿어주셔서 너무 감사해요 😊\n앞으로도 더더욱 잘 챙겨드릴게요 💚`,
      `{name} 님~ 보험 가입 기념일이에요! 🎊\n{name} 님 덕분에 저도 행복하게 일하고 있어요 💚\n오래오래 함께해요~!`,
    ],
    간결: [
      `{name} 님, 보험 가입 기념일을 축하드립니다! 🎉\n그동안 함께해 주셔서 감사합니다.`,
      `{name} 님, 기념일 축하드립니다! 앞으로도 잘 부탁드립니다 😊`,
      `{name} 님, 보험 기념일입니다. 감사합니다. 앞으로도 잘 챙겨드릴게요.`,
    ],
  },
  일반: {
    정중: [
      `안녕하세요 {name} 님,\n담당 설계사입니다.\n{name} 님의 보험이 잘 유지되고 있는지 확인차 연락드렸습니다.\n혹시 보험 관련하여 궁금하신 점이 있거나 변경 사항이 있으시면,\n언제든지 편하게 말씀해 주시기 바랍니다.\n항상 {name} 님 곁에서 도움이 되겠습니다.\n- 담당 설계사 드림`,
      `안녕하세요 {name} 님,\n담당 설계사입니다. 안부 전하고자 연락드렸습니다.\n보험은 생활의 변화에 따라 주기적인 점검이 필요한데,\n혹시 최근에 삶에 변화가 있으셨다면 보험도 함께 검토해 드릴 수 있습니다.\n편하신 시간에 말씀 주세요.\n- 담당 설계사 드림`,
      `안녕하세요 {name} 님,\n담당 설계사입니다.\n{name} 님의 소중한 보험이 잘 관리되고 있는지 점검해 드리고 싶어 연락드렸습니다.\n궁금하신 점이 있으시면 편하게 연락 주시기 바랍니다.\n- 담당 설계사 드림`,
    ],
    친근: [
      `안녕하세요 {name} 님! 😊\n담당 설계사예요!\n잘 지내고 계시죠?\n오랜만에 {name} 님 생각이 나서 연락드렸어요!\n보험 관련해서 궁금하신 거 있으시면 언제든지 편하게 연락 주세요 💚`,
      `안녕하세요 {name} 님! 😄\n잘 지내고 계시죠?\n갑자기 {name} 님 생각이 나서 연락드렸어요 ㅎㅎ\n혹시 요즘 보험이나 재무 관련해서 고민이 있으시면 편하게 얘기해 주세요!\n도움이 될 수 있도록 항상 최선을 다할게요 💚`,
      `안녕하세요 {name} 님! 😊\n담당 설계사예요!\n요즘 잘 지내고 계시죠?\n보험 관련해서 뭔가 변화가 있거나 궁금한 게 생기시면 편하게 연락 주세요!\n항상 응원하고 있어요 💚`,
    ],
    애교: [
      `{name} 님~ 안녕하세요! 😊\n잘 지내고 계시죠?\n{name} 님이 생각나서 연락드렸어요 ㅎㅎ\n보험 관련해서 궁금한 거 있으시면 편하게 말씀해 주세요 💚`,
      `{name} 님~! 안녕하세요~ 😄\n갑자기 생각나서 연락드렸어요!\n무엇이든 도움이 필요하시면 연락주세요~ 💚`,
      `{name} 님~ 안녕하세요! 😊\n오늘 갑자기 생각이 나서요~\n보험이든 뭐든 궁금하신 거 있으시면 언제든지 연락주세요! 💚`,
    ],
    간결: [
      `{name} 님, 안녕하세요. 담당 설계사입니다.\n보험 관련 궁금한 점 있으시면 언제든 연락 주세요.`,
      `{name} 님, 안부 전합니다. 궁금한 점 있으시면 연락 주세요.`,
      `{name} 님, 안녕하세요. 필요하신 것 있으면 말씀해 주세요.`,
    ],
  },
}

// 상황 감지 함수
function detectSituation(customer: any, meetings: any[], contracts: any[], coverages: any[]): { type: SituationType; label: string } {
  const today = new Date()
  const cMeetings = meetings.filter(m => m.customer_id === customer?.id)
  const cContracts = contracts.filter(ct => ct.customer_id === customer?.id)

  // 1. 최근 7일 내 완료 미팅
  const recentMeeting = cMeetings.find(m => {
    if (m.status !== '완료') return false
    const diff = (today.getTime() - new Date(m.meeting_date).getTime()) / 86400000
    return diff >= 0 && diff <= 7
  })
  if (recentMeeting) return { type: '최근미팅', label: '최근 미팅 후속' }

  // 2. 최근 30일 내 계약
  const recentContract = cContracts.find(ct => {
    if (!ct.created_at) return false
    const diff = (today.getTime() - new Date(ct.created_at).getTime()) / 86400000
    return diff >= 0 && diff <= 30
  })
  if (recentContract) return { type: '최근계약', label: '계약 감사' }

  // 3. 생일 임박 (7일 이내)
  if (customer?.birth_date) {
    const birth = new Date(customer.birth_date)
    const thisYear = new Date(today.getFullYear(), birth.getMonth(), birth.getDate())
    const diff = (thisYear.getTime() - today.getTime()) / 86400000
    if (diff >= 0 && diff <= 7) return { type: '생일임박', label: diff === 0 ? '🎂 생일 당일' : `🎂 생일 D-${Math.ceil(diff)}` }
  }

  // 4. 완납 임박 (90% 이상)
  const nearDone = cContracts.find(ct => {
    if (ct.payment_status === '완납' || !ct.payment_years || !ct.contract_start) return false
    const start = new Date(ct.contract_start.replace(/\./g, '-') + '-01')
    const totalMonths = parseFloat(ct.payment_years) * 12
    const paidMonths = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth())
    return totalMonths > 0 && Math.min(Math.round((paidMonths / totalMonths) * 100), 100) >= 90
  })
  if (nearDone) return { type: '완납임박', label: '🔥 완납 임박' }

  // 5. 보장 공백
  if (cContracts.length > 0) {
    const cCovs = coverages.filter(cv => cContracts.some(ct => ct.id === cv.contract_id))
    const brainTypes = cCovs.filter(cv => cv.category === '뇌혈관').map(cv => cv.brain_coverage_type)
    if (brainTypes.length === 0 || brainTypes.every((t: string) => t === '뇌출혈')) return { type: '보장공백', label: '⚠️ 보장 공백' }
  }

  // 6. 만기 임박 (30일 이내)
  const nearExpiry = cContracts.find(ct => {
    if (!ct.expiry_date) return false
    const diff = (new Date(ct.expiry_date).getTime() - today.getTime()) / 86400000
    return diff >= 0 && diff <= 30
  })
  if (nearExpiry) return { type: '만기임박', label: '⏰ 만기 임박' }

  // 7. 장기 미연락 (90일 이상)
  if (cMeetings.length > 0) {
    const last = cMeetings.sort((a: any, b: any) => b.meeting_date.localeCompare(a.meeting_date))[0]
    const diff = (today.getTime() - new Date(last.meeting_date).getTime()) / 86400000
    if (diff > 90) return { type: '장기미연락', label: '💬 장기 미연락' }
  }

  // 8. 계약 기념일 (7일 이내)
  const annivContract = cContracts.find(ct => {
    if (!ct.contract_start) return false
    const parts = ct.contract_start.split('.')
    if (parts.length < 2) return false
    const startYear = parseInt(parts[0])
    const startMonth = parseInt(parts[1]) - 1
    const startDay = parts[2] ? parseInt(parts[2]) : 1
    const years = today.getFullYear() - startYear
    if (years <= 0) return false
    const anniv = new Date(today.getFullYear(), startMonth, startDay)
    const diff = Math.ceil((anniv.getTime() - today.getTime()) / 86400000)
    return diff >= 0 && diff <= 7
  })
  if (annivContract) return { type: '계약기념일', label: '🎉 계약 기념일' }

  // 9. 첫 인사
  if (cMeetings.length === 0 && cContracts.length === 0) return { type: '첫인사', label: '👋 첫 인사' }

  return { type: '일반', label: '📱 일반' }
}

// 랜덤 스크립트 선택
function getRandomScript(type: SituationType, tone: ToneType, name: string): string {
  const variants = SCRIPTS[type]?.[tone] || SCRIPTS['일반'][tone]
  const tpl = variants[Math.floor(Math.random() * variants.length)]
  return tpl.replace(/{name}/g, name)
}

interface SmsSlidePanelProps {
  isOpen: boolean
  onClose: () => void
  customer: any
  meetings?: any[]
  contracts?: any[]
  coverages?: any[]
  scriptType?: string
  agentId?: string
}

export default function SmsSlidePanel({ isOpen, onClose, customer, meetings = [], contracts = [], coverages = [], scriptType, agentId }: SmsSlidePanelProps) {
  const [tone, setTone] = useState<ToneType>('친근')
  const [scriptText, setScriptText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState(false)
  function showToast() { setToast(true); setTimeout(() => setToast(false), 2500) }
  const [situation, setSituation] = useState<{ type: SituationType; label: string }>({ type: '일반', label: '📱 일반' })
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && customer) {
      setAiLoading(true)
      const detected = scriptType
        ? { type: scriptType as SituationType, label: scriptType }
        : detectSituation(customer, meetings, contracts, coverages)
      setSituation(detected)
      setTimeout(() => {
        setScriptText(getRandomScript(detected.type, tone, customer.name))
        setAiLoading(false)
      }, 500)
    }
  }, [isOpen, customer])

  function changeTone(t: ToneType) {
    setTone(t)
    if (!customer) return
    setAiLoading(true)
    setTimeout(() => {
      setScriptText(getRandomScript(situation.type, t, customer.name))
      setAiLoading(false)
    }, 300)
  }

  // 다시 생성 (같은 상황 랜덤 재선택)
  function regenerate() {
    if (!customer) return
    setAiLoading(true)
    setTimeout(() => {
      setScriptText(getRandomScript(situation.type, tone, customer.name))
      setAiLoading(false)
    }, 400)
  }

  function insertEmoji(emoji: string) {
    const el = textareaRef.current
    if (!el) return setScriptText(prev => prev + emoji)
    const start = el.selectionStart; const end = el.selectionEnd
    const next = scriptText.slice(0, start) + emoji + scriptText.slice(end)
    setScriptText(next)
    setTimeout(() => { el.selectionStart = el.selectionEnd = start + emoji.length; el.focus() }, 0)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(scriptText)
    if (agentId && customer?.id) await supabase.from('dpa_messages').insert({ agent_id: agentId, customer_id: customer.id, message_type: situation.type, is_sent: false, sent_script: scriptText })
    alert('복사됐어요! 카톡에 붙여넣으세요 😊')
    onClose()
  }

  // 카카오톡 딥링크
  async function handleKakao() {
    await navigator.clipboard.writeText(scriptText)
    if (agentId && customer?.id) {
      await supabase.from('dpa_messages').insert({
        agent_id: agentId, customer_id: customer.id,
        message_type: situation.type, is_sent: false, sent_script: scriptText,
      })
    }
    // 1. 클립보드에 스크립트 복사
    try { await navigator.clipboard.writeText(scriptText) } catch {}
    // 2. 카카오톡 앱 열기 (모바일) 또는 카카오톡 웹 열기 (PC)
    const isMobile = /android|iphone|ipad/i.test(navigator.userAgent)
    if (isMobile) {
      window.location.href = 'kakaotalk://launch'
      setTimeout(() => { window.open('https://chat.kakao.com', '_blank') }, 1500)
    } else {
      window.open('https://chat.kakao.com', '_blank')
    }
    alert('📋 문자가 복사됐어요!
카카오톡에서 붙여넣기(꾹 누르기)해서 보내주세요 😊')
    onClose()
  }

  async function handleSend() {
    if (!scriptText) return
    if (!customer?.phone) { alert('고객 연락처가 없습니다.'); return }
    setSending(true)
    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: customer.phone,
          text: scriptText,
          agent_id: agentId,
          customer_id: customer.id,
          message_type: situation.type,
        }),
      })
      const result = await res.json()
      if (result.success) {
        alert(`${customer?.name} 님께 문자가 발송됐어요! 😊 (남은 ${result.usage.remaining}건)`)
        onClose()
      } else {
        alert(`발송 실패: ${result.error}`)
      }
    } catch { alert('발송 중 오류가 발생했어요.') }
    setSending(false)
  }

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    let startY = 0, curY = 0, dragging = false
    const onStart = (e: TouchEvent) => { startY = e.touches[0].clientY; dragging = true; panel.style.transition = 'none'; e.stopPropagation() }
    const onMove = (e: TouchEvent) => { if (!dragging) return; e.stopPropagation(); e.preventDefault(); curY = e.touches[0].clientY - startY; if (curY > 0) panel.style.transform = `translateY(${curY}px)` }
    const onEnd = (e: TouchEvent) => { if (!dragging) return; dragging = false; e.stopPropagation(); panel.style.transition = 'transform 0.3s ease'; if (curY > 100) { panel.style.transform = 'translateY(100%)'; setTimeout(onClose, 280) } else { panel.style.transform = 'translateY(0)' }; curY = 0 }
    panel.addEventListener('touchstart', onStart, { passive: true })
    panel.addEventListener('touchmove', onMove, { passive: false })
    panel.addEventListener('touchend', onEnd, { passive: true })
    return () => { panel.removeEventListener('touchstart', onStart); panel.removeEventListener('touchmove', onMove); panel.removeEventListener('touchend', onEnd) }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, animation: 'fadeIn 0.2s ease' }} />
      <div ref={panelRef} style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--bg-card)', borderRadius: '20px 20px 0 0', zIndex: 1001, maxHeight: '90vh', display: 'flex', flexDirection: 'column', animation: 'slideUp 0.3s ease', boxShadow: '0 -4px 20px rgba(0,0,0,0.15)' }}>

        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', cursor: 'pointer', flexShrink: 0 }} onClick={onClose}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border)' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--green-light)', color: 'var(--green)', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
            {customer?.name?.slice(0, 2) || '??'}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{customer?.name || '고객'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{customer?.phone || '연락처 없음'}</div>
          </div>
          <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--green-light)', color: 'var(--green)', fontWeight: 700, whiteSpace: 'nowrap' }}>{situation.label}</span>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 20, color: 'var(--text-muted)', cursor: 'pointer', padding: '4px 8px' }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: aiLoading ? '#FCD34D' : '#1D9E75', animation: aiLoading ? 'pulse 1s infinite' : 'none' }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {aiLoading ? '스크립트 작성중...' : `상황 맞춤 · ${situation.label}`}
              </span>
            </div>
            <button onClick={regenerate} disabled={aiLoading} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-secondary)', cursor: 'pointer' }}>🔄 다시 생성</button>
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {TONES.map(t => (
              <button key={t} onClick={() => changeTone(t)} style={{ padding: '5px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: tone === t ? '#1D9E75' : 'var(--bg)', color: tone === t ? 'white' : 'var(--text-secondary)' }}>{t}</button>
            ))}
          </div>

          <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 12, marginBottom: 10 }}>
            <textarea ref={textareaRef} value={scriptText} onChange={e => setScriptText(e.target.value)} rows={9}
              style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)', resize: 'none', outline: 'none', fontFamily: 'inherit' }}
              placeholder="스크립트를 작성해주세요..." />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {EMOJIS.map(e => (
              <button key={e} onClick={() => insertEmoji(e)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 6px', fontSize: 16, cursor: 'pointer' }}>{e}</button>
            ))}
          </div>
        </div>

        <div style={{ padding: '12px 16px 4px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button onClick={handleKakao} style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: '#FEE500', color: '#3A1D1D', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <span style={{ fontSize: 18 }}>💬</span> 복사 후 카톡으로 보내기
          </button>
          <div style={{ display: 'flex', gap: 8, paddingBottom: 24 }}>
            <button onClick={handleSend} disabled={sending || !scriptText} style={{ flex: 1, padding: '11px', borderRadius: 12, border: 'none', background: '#1D9E75', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: sending ? 0.7 : 1 }}>{sending ? '발송 중...' : '📱 문자 보내기'}</button>
          </div>
        </div>
        {toast && (
          <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '10px 20px', borderRadius: 20, fontSize: 13, fontWeight: 600, zIndex: 2000, whiteSpace: 'nowrap', animation: 'fadeIn 0.2s ease' }}>
            📋 복사됐어요! 카톡에서 붙여넣기 해주세요 😊
          </div>
        )}
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
      `}</style>
    </>
  )
}
