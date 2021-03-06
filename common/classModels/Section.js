/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import _ from 'lodash';

import macros from '../commonMacros';
import Meeting from './Meeting';

class Section {
  constructor(config) {
    //loading status is done if any sign that has data
    if (config.dataStatus !== undefined) {
      this.dataStatus = config.dataStatus;
    } else if (this.lastUpdateTime !== undefined || this.meetings) {
      this.dataStatus = macros.DATASTATUS_DONE;
    }

    //seperate reasons to meet: eg Lecture or Lab.
    //each of these then has times, and days
    //instances of Meeting
    this.meetings = [];
  }

  static create(config) {
    const instance = new this(config);
    instance.updateWithData(config);
    return instance;
  }


  meetsOnWeekends() {
    for (let i = 0; i < this.meetings.length; i++) {
      const meeting = this.meetings[i];

      if (meeting.getMeetsOnWeekends()) {
        return true;
      }
    }
    return false;
  }

  getAllMeetingMoments(ignoreExams = true) {
    let retVal = [];
    this.meetings.forEach((meeting) => {
      if (ignoreExams && meeting.getIsExam()) {
        return;
      }

      retVal = retVal.concat(_.flatten(meeting.times));
    });

    retVal.sort((a, b) => {
      if (a.start.unix() > b.start.unix()) {
        return 1;
      } else if (a.start.unix() < b.start.unix()) {
        return -1;
      }

      return 0;
    });

    return retVal;
  }

  //returns [false,true,false,true,false,true,false] if meeting mon, wed, fri
  getWeekDaysAsBooleans() {
    const retVal = [false, false, false, false, false, false, false];


    this.getAllMeetingMoments().forEach((time) => {
      retVal[time.start.day()] = true;
    });

    return retVal;
  }

  getWeekDaysAsStringArray() {
    const retVal = [];

    this.getAllMeetingMoments().forEach((time) => {
      const day = time.start.format('dddd');
      if (retVal.includes(day)) {
        return;
      }
      retVal.push(day);
    });

    return retVal;
  }

  //returns true if has exam, else false
  getHasExam() {
    for (let i = 0; i < this.meetings.length; i++) {
      if (this.meetings[i].getIsExam()) {
        return true;
      }
    }
    return false;
  }

  //returns the {start:end:} moment object of the first exam found
  //else returns null
  getExamMeeting() {
    for (let i = 0; i < this.meetings.length; i++) {
      const meeting = this.meetings[i];
      if (meeting.getIsExam()) {
        if (meeting.times.length > 0) {
          return meeting;
        }
      }
    }
    return null;
  }

  // Unique list of all professors in all meetings, sorted alphabetically
  getProfs() {
    const retVal = [];
    this.meetings.forEach((meeting) => {
      meeting.profs.forEach((prof) => {
        if (!retVal.includes(prof)) {
          retVal.push(prof);
        }
      });
    });

    retVal.sort();

    return retVal;
  }

  getLocations(ignoreExams) {
    if (ignoreExams === undefined) {
      ignoreExams = true;
    }

    const retVal = [];
    this.meetings.forEach((meeting) => {
      if (ignoreExams && meeting.getIsExam()) {
        return;
      }

      const where = meeting.where;
      if (!retVal.includes(where)) {
        retVal.push(where);
      }
    });

    // If it is at least 1 long with TBAs remove, return the array without any TBAs
    const noTBAs = _.pull(retVal.slice(0), 'TBA');
    if (noTBAs.length > 0) {
      return noTBAs;
    }

    return retVal;
  }

  getUniqueStartTimes(ignoreExams) {
    if (ignoreExams === undefined) {
      ignoreExams = true;
    }

    const retVal = [];

    this.getAllMeetingMoments(ignoreExams).forEach((time) => {
      const string = time.start.format('h:mm a');
      if (!retVal.includes(string)) {
        retVal.push(string);
      }
    });

    return retVal;
  }

  getUniqueEndTimes(ignoreExams) {
    if (ignoreExams === undefined) {
      ignoreExams = true;
    }

    const retVal = [];

    this.getAllMeetingMoments(ignoreExams).forEach((time) => {
      const string = time.end.format('h:mm a');
      if (!retVal.includes(string)) {
        retVal.push(string);
      }
    });

    return retVal;
  }

  getHasWaitList() {
    if (this.waitCapacity > 0 || this.waitRemaining > 0) {
      return true;
    }

    return false;
  }


  updateWithData(data) {
    for (const attrName in data) {
      if ((typeof data[attrName]) === 'function') {
        macros.error('given fn??', data, this, this.constructor.name);
        continue;
      }
      this[attrName] = data[attrName];
    }

    if (data.meetings) {
      const newMeetings = [];

      data.meetings.forEach((serverData) => {
        newMeetings.push(new Meeting(serverData));
      });

      this.meetings = newMeetings;
    }
  }


  compareTo(other) {
    if (this.online && !other.online) {
      return 1;
    }
    if (other.online && !this.online) {
      return -1;
    }

    if (this.meetings.length === 0 && other.meetings.length === 0) {
      return 0;
    }
    if (this.meetings.length > 0 && other.meetings.length === 0) {
      return -1;
    } else if (this.meetings.length === 0 && other.meetings.length > 0) {
      return 1;
    }

    // If both sections have meetings, then sort alphabetically by professor.
    const thisProfs = this.getProfs();
    const otherProfs = other.getProfs();
    const thisOnlyTBA = thisProfs.length === 1 && thisProfs[0] === 'TBA';
    const otherOnlyTBA = otherProfs.length === 1 && otherProfs[0] === 'TBA';

    if (thisProfs.length > 0 || otherProfs.length > 0) {
      if (thisProfs.length === 0) {
        return -1;
      }
      if (otherProfs.length === 0) {
        return 1;
      }

      if (thisOnlyTBA && !otherOnlyTBA) {
        return 1;
      }
      if (!thisOnlyTBA && otherOnlyTBA) {
        return -1;
      }

      if (thisProfs[0] > otherProfs[0]) {
        return 1;
      }
      if (otherProfs[0] > thisProfs[0]) {
        return -1;
      }
    }

    // Then, sort by the starting time of the section.
    if (this.meetings[0].times.length === 0) {
      return 1;
    }
    if (other.meetings[0].times.length === 0) {
      return -1;
    }
    if (this.meetings[0].times[0][0].start.unix() < other.meetings[0].times[0][0].start.unix()) {
      return -1;
    }
    if (this.meetings[0].times[0][0].start.unix() > other.meetings[0].times[0][0].start.unix()) {
      return 1;
    }

    return 0;
  }
}


Section.requiredPath = ['host', 'termId', 'subject', 'classUid'];
Section.optionalPath = ['crn'];
Section.API_ENDPOINT = '/listSections';


export default Section;
